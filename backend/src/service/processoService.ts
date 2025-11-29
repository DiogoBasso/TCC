import dayjs from "dayjs"
import "dayjs/locale/pt-br"
import utc from "dayjs/plugin/utc"
import path from "path"
import { ClassLevel, ProcessStatus, ProcessType } from "@prisma/client"
import {
  AberturaProcessoDto,
  UpdateProcessoDto,
  UserPatchDto
} from "../type/dto/processoDto"
import { renderDocxFromTemplate } from "../util/docx"
import { convertDocxToPdf } from "../util/convertToPdf"
import { ProcessRepository } from "../repository/processoRepository"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { UserRepository } from "../repository/userRepository"
import { ProcessScoreRepository } from "../repository/processScoreRepository"

dayjs.locale("pt-br")
dayjs.extend(utc)

export class BusinessRuleError extends Error {
  details?: any

  constructor(message: string, details?: any) {
    super(message)
    this.name = "BusinessRuleError"
    this.details = details
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

export class ProcessoService {
  constructor(
    private readonly processRepo: ProcessRepository,
    private readonly tableRepo: ScoringTableRepository,
    private readonly userRepo: UserRepository,
    private readonly scoreRepo: ProcessScoreRepository = new ProcessScoreRepository()
  ) { }

    // ---- ENVIO DO PROCESSO PARA AVALIAÇÃO DA CPPD ----------------------------

  async enviarParaAvaliacao(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findById(processId)
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (
      careerProcess.status !== ProcessStatus.DRAFT &&
      careerProcess.status !== ProcessStatus.RETURNED
    ) {
      throw new BusinessRuleError(
        "Só é permitido enviar processos nos status DRAFT ou RETURNED."
      )
    }

    // ✅ Garante regra de interstício e combinação (mesma usada para gerar requerimento)
    this.validarRegrasDeRequerimento(careerProcess)

    // ✅ Soma total de pontos do processo
    const totalPontos = await this.scoreRepo.sumTotalAwardedPointsByProcess(processId)

    if (totalPontos < 120) {
      throw new BusinessRuleError(
        `Para enviar o processo é necessário atingir ao menos 120 pontos. ` +
          `Pontuação atual: ${totalPontos.toFixed(2)}.`,
        {
          requiredMinimum: 120,
          currentTotal: totalPontos
        }
      )
    }

    // ✅ Atualiza status para SUBMITTED
    const updated = await this.processRepo.updateStatus(
      processId,
      ProcessStatus.SUBMITTED
    )

    // 📝 Futuro:
    // - gerar PDF da planilha de pontuação
    // - gerar PDF único com todos os comprovantes na ordem da planilha
    // - salvar caminhos/URLs desses arquivos no processo

    return {
      processId: updated.idProcess,
      status: updated.status,
      totalPoints: totalPontos
    }
  }

  // ---- ABERTURA DE PROCESSO -------------------------------------------------

  async abrirComAtualizacao(
    userId: number,
    patch: UserPatchDto | null,
    dto: AberturaProcessoDto
  ) {
    const now = new Date()

    if (patch) {
      const updateInput: any = {
        name: patch.name,
        email: patch.email,
        phone: patch.phone ?? undefined,
        city: patch.city ?? undefined,
        uf: patch.uf ?? undefined,
        docenteProfile: patch.docenteProfile
          ? {
            siape: patch.docenteProfile.siape,
            classLevel: patch.docenteProfile.classLevel,
            startInterstice: patch.docenteProfile.startInterstice
              ? new Date(patch.docenteProfile.startInterstice)
              : undefined,
            educationLevel: patch.docenteProfile.educationLevel,
            assignment: patch.docenteProfile.assignment ?? undefined   // 👈 aqui
          }
          : undefined
      }

      await this.userRepo.updateWithRolesAndDocente(userId, updateInput)
    }


    const vigente = await this.tableRepo.findVigente(now)
    if (!vigente) {
      throw new Error("Nenhuma tabela de pontuação vigente")
    }

    const processType: ProcessType = dto.tipo
    console.log("ProcessoService.abrirComAtualizacao => processType:", processType)

    // 1) Regra: usuário não pode ter mais de um processo em andamento
    const active = await this.processRepo.findAnyActiveProcessForUser(userId)
    if (active) {
      const msg =
        `Já existe um processo em andamento (nº ${active.idProcess}, status ${active.status}). ` +
        "Conclua (ou exclua) esse processo antes de abrir um novo."

      throw new BusinessRuleError(msg, {
        existingProcessId: active.idProcess,
        existingStatus: active.status
      })
    }

    // 2) valida classe+nível com base no enum ClassLevel
    this.validarClasseENivel(dto.classeOrigem, dto.nivelOrigem, "origem")
    this.validarClasseENivel(dto.classeDestino, dto.nivelDestino, "destino")

    const origemCodigo = `${dto.classeOrigem}${dto.nivelOrigem}`.toUpperCase()
    const destinoCodigo = `${dto.classeDestino}${dto.nivelDestino}`.toUpperCase()

    // 3) valida se a combinação de origem/destino é permitida para o tipo de processo
    this.validarCombinacaoProgressaoOuPromocao(
      processType,
      origemCodigo,
      destinoCodigo
    )

    const intersticeStart = new Date(dto.intersticioInicioISO)
    const intersticeEnd = new Date(dto.intersticioFimISO)

    // 4) Regra: o próximo processo deve ser posterior ao último interstício aprovado
    const lastApproved = await this.processRepo.findLastApprovedProcessForUser(userId)

    if (lastApproved) {
      const lastEnd = lastApproved.intersticeEnd

      // se o início do novo interstício for <= fim do último aprovado, bloqueia
      if (intersticeStart <= lastEnd) {
        const formattedLastEnd = dayjs(lastEnd).format("DD/MM/YYYY")

        const msg =
          `Já existe um processo APROVADO com interstício até ${formattedLastEnd} ` +
          `(nº ${lastApproved.idProcess}, ${lastApproved.type}). ` +
          "O próximo processo só pode ter início após essa data."

        throw new BusinessRuleError(msg, {
          lastApprovedProcessId: lastApproved.idProcess,
          lastApprovedType: lastApproved.type,
          lastApprovedIntersticeEnd: lastEnd
        })
      }
    }

    // 5) Se já existe APROVADO com MESMO interstício, não pode abrir outro (qualquer tipo)
    const existingApprovedByInterstice = await this.processRepo.findApprovedByInterstice(
      userId,
      intersticeStart,
      intersticeEnd
    )

    if (existingApprovedByInterstice) {
      const msg =
        `Já existe um processo APROVADO para este interstício ` +
        `(nº ${existingApprovedByInterstice.idProcess}, ${existingApprovedByInterstice.type}). ` +
        "Não é permitido abrir nova progressão/promoção para o mesmo período."

      throw new BusinessRuleError(msg, {
        existingProcessId: existingApprovedByInterstice.idProcess,
        existingStatus: existingApprovedByInterstice.status,
        existingType: existingApprovedByInterstice.type
      })
    }

    // 6) Se já existe APROVADO com MESMA movimentação (tipo + origem + destino),
    // não pode abrir outro igual (independente do interstício).
    const existingApprovedByMovement = await this.processRepo.findApprovedByMovement(
      userId,
      processType,
      dto.classeOrigem,
      dto.nivelOrigem,
      dto.classeDestino,
      dto.nivelDestino
    )

    if (existingApprovedByMovement) {
      const msg =
        `Já existe um processo APROVADO com esta movimentação ` +
        `(nº ${existingApprovedByMovement.idProcess}, ${existingApprovedByMovement.type}, ` +
        `${existingApprovedByMovement.classeOrigem}${existingApprovedByMovement.nivelOrigem} → ` +
        `${existingApprovedByMovement.classeDestino}${existingApprovedByMovement.nivelDestino}). ` +
        "Não é permitido abrir novamente a mesma progressão/promoção."

      throw new BusinessRuleError(msg, {
        existingProcessId: existingApprovedByMovement.idProcess,
        existingStatus: existingApprovedByMovement.status,
        existingType: existingApprovedByMovement.type
      })
    }

    const created = await this.processRepo.create(
      userId,
      vigente.idScoringTable,
      processType,
      dto
    )

    return this.mapProcessToDto(created)
  }

  // ---- LISTAGEM E CONSULTA DE PROCESSOS -------------------------------------

  async listarProcessos(userId: number, statuses?: ProcessStatus[]) {
    const list = await this.processRepo.listByUser(userId, statuses)
    return list.map(p => this.mapProcessToDto(p))
  }

  async obterProcessoPorId(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findById(processId)
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    return this.mapProcessToDto(careerProcess)
  }

  // ---- EXCLUSÃO -------------------------------------------------------------

  async excluirProcesso(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findById(processId)
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (
      careerProcess.status !== ProcessStatus.DRAFT &&
      careerProcess.status !== ProcessStatus.REJECTED
    ) {
      throw new BusinessRuleError(
        "Só é permitido excluir processos nos status DRAFT ou REJECTED."
      )
    }

    const deleted = await this.processRepo.softDelete(processId)

    return {
      processId: deleted.idProcess,
      status: deleted.status,
      deletedDate: deleted.deletedDate
    }
  }

  // ---- EDIÇÃO ---------------------------------------------------------------

  async editarProcesso(
    processId: number,
    userId: number,
    dto: UpdateProcessoDto
  ) {
    const careerProcess = await this.processRepo.findById(processId)
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (
      careerProcess.status !== ProcessStatus.DRAFT &&
      careerProcess.status !== ProcessStatus.RETURNED &&
      careerProcess.status !== ProcessStatus.REJECTED
    ) {
      throw new BusinessRuleError(
        "Só é permitido editar processos nos status DRAFT, RETURNED ou REJECTED."
      )
    }

    const newIntersticeStart = dto.intersticioInicioISO
      ? new Date(dto.intersticioInicioISO)
      : careerProcess.intersticeStart

    const newIntersticeEnd = dto.intersticioFimISO
      ? new Date(dto.intersticioFimISO)
      : careerProcess.intersticeEnd

    const classeOrigemFinal =
      dto.classeOrigem !== undefined ? dto.classeOrigem : careerProcess.classeOrigem
    const nivelOrigemFinal =
      dto.nivelOrigem !== undefined ? dto.nivelOrigem : careerProcess.nivelOrigem
    const classeDestinoFinal =
      dto.classeDestino !== undefined
        ? dto.classeDestino
        : careerProcess.classeDestino
    const nivelDestinoFinal =
      dto.nivelDestino !== undefined
        ? dto.nivelDestino
        : careerProcess.nivelDestino

    this.validarClasseENivel(classeOrigemFinal, nivelOrigemFinal, "origem")
    this.validarClasseENivel(classeDestinoFinal, nivelDestinoFinal, "destino")

    const origemCodigo = `${classeOrigemFinal}${nivelOrigemFinal}`.toUpperCase()
    const destinoCodigo = `${classeDestinoFinal}${nivelDestinoFinal}`.toUpperCase()

    this.validarCombinacaoProgressaoOuPromocao(
      careerProcess.type,
      origemCodigo,
      destinoCodigo
    )

    // regra de sequência também vale na edição: não pode "puxar" o interstício
    // para antes do último aprovado
    const lastApproved = await this.processRepo.findLastApprovedProcessForUser(userId)

    if (lastApproved) {
      const lastEnd = lastApproved.intersticeEnd

      // se este processo ainda não é o próprio "lastApproved"
      // (por segurança, embora edição de APPROVED não seja permitida)
      if (lastApproved.idProcess !== processId) {
        if (newIntersticeStart <= lastEnd) {
          const formattedLastEnd = dayjs(lastEnd).format("DD/MM/YYYY")

          const msg =
            `Já existe um processo APROVADO com interstício até ${formattedLastEnd} ` +
            `(nº ${lastApproved.idProcess}, ${lastApproved.type}). ` +
            "O próximo processo só pode ter início após essa data."

          throw new BusinessRuleError(msg, {
            lastApprovedProcessId: lastApproved.idProcess,
            lastApprovedType: lastApproved.type,
            lastApprovedIntersticeEnd: lastEnd
          })
        }
      }
    }

    if (
      dto.intersticioInicioISO !== undefined ||
      dto.intersticioFimISO !== undefined
    ) {
      const existingOverlap = await this.processRepo.findByUserAndInterstice(
        userId,
        newIntersticeStart,
        newIntersticeEnd,
        processId
      )

      if (existingOverlap) {
        const message =
          `Já existe outro processo para um interstício que se sobrepõe a este ` +
          `(nº ${existingOverlap.idProcess}). Ajuste o período ou utilize o processo existente.`

        throw new BusinessRuleError(message, {
          existingProcessId: existingOverlap.idProcess
        })
      }
    }

    const existingApprovedByInterstice = await this.processRepo.findApprovedByInterstice(
      userId,
      newIntersticeStart,
      newIntersticeEnd,
      processId
    )

    if (existingApprovedByInterstice) {
      const msg =
        `Já existe um processo APROVADO com este interstício ` +
        `(nº ${existingApprovedByInterstice.idProcess}, ${existingApprovedByInterstice.type}). ` +
        "Não é permitido editar este processo para usar o mesmo período."

      throw new BusinessRuleError(msg, {
        existingProcessId: existingApprovedByInterstice.idProcess,
        existingStatus: existingApprovedByInterstice.status,
        existingType: existingApprovedByInterstice.type
      })
    }

    const existingApprovedByMovement = await this.processRepo.findApprovedByMovement(
      userId,
      careerProcess.type,
      classeOrigemFinal,
      nivelOrigemFinal,
      classeDestinoFinal,
      nivelDestinoFinal,
      processId
    )

    if (existingApprovedByMovement) {
      const msg =
        `Já existe um processo APROVADO com esta movimentação ` +
        `(nº ${existingApprovedByMovement.idProcess}, ${existingApprovedByMovement.type}, ` +
        `${existingApprovedByMovement.classeOrigem}${existingApprovedByMovement.nivelOrigem} → ` +
        `${existingApprovedByMovement.classeDestino}${existingApprovedByMovement.nivelDestino}). ` +
        "Não é permitido editar este processo para duplicar uma progressão/promoção já aprovada."

      throw new BusinessRuleError(msg, {
        existingProcessId: existingApprovedByMovement.idProcess,
        existingStatus: existingApprovedByMovement.status,
        existingType: existingApprovedByMovement.type
      })
    }

    const updateData: any = {}

    if (dto.campus !== undefined) {
      updateData.campus = dto.campus
    }
    if (dto.cidadeUF !== undefined) {
      updateData.cidadeUF = dto.cidadeUF
    }
    if (dto.intersticioInicioISO !== undefined) {
      updateData.intersticeStart = newIntersticeStart
    }
    if (dto.intersticioFimISO !== undefined) {
      updateData.intersticeEnd = newIntersticeEnd
    }
    if (dto.classeOrigem !== undefined) {
      updateData.classeOrigem = classeOrigemFinal
    }
    if (dto.nivelOrigem !== undefined) {
      updateData.nivelOrigem = nivelOrigemFinal
    }
    if (dto.classeDestino !== undefined) {
      updateData.classeDestino = classeDestinoFinal
    }
    if (dto.nivelDestino !== undefined) {
      updateData.nivelDestino = nivelDestinoFinal
    }

    if (Object.keys(updateData).length === 0) {
      return this.mapProcessToDto(careerProcess)
    }

    const updated = await this.processRepo.updateProcess(processId, updateData)

    return this.mapProcessToDto(updated)
  }

  // ---- GERAR REQUERIMENTO (PDF) ---------------------------------------------

  async gerarRequerimento(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findById(processId)
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    const processType: ProcessType = careerProcess.type

    this.validarRegrasDeRequerimento(careerProcess)

    const user = await this.userRepo.findById(userId)
    if (!user) {
      throw new Error("Usuário não encontrado")
    }

    const nomeProfessor = user.name
    const email = user.email
    const celular = user.phone ?? ""
    const siape = user.docente?.siape ?? ""

    const dataEmissao = dayjs()

    // usa UTC para não “voltar um dia” por causa do fuso horário
    const interIni = dayjs.utc(careerProcess.intersticeStart)
    const interFim = dayjs.utc(careerProcess.intersticeEnd)

    const dataPorExtenso =
      `${careerProcess.cidadeUF}, ${dataEmissao.format("DD")} de ` +
      `${dataEmissao.format("MMMM")} de ${dataEmissao.format("YYYY")}`

    const intersticioStr =
      `${interIni.format("DD/MM/YYYY")} a ${interFim.format("DD/MM/YYYY")}`

    const classeNivelOrigem =
      `Classe ${careerProcess.classeOrigem} / Nível ${careerProcess.nivelOrigem}`
    const classeNivelDestino =
      `Classe ${careerProcess.classeDestino} / Nível ${careerProcess.nivelDestino}`

    const vars = {
      campus: careerProcess.campus,
      cidade_data: dataPorExtenso,
      nome_professor: nomeProfessor,
      siape,
      email,
      celular,
      classe_nivel_origem: classeNivelOrigem,
      classe_nivel_destino: classeNivelDestino,
      intersticio: intersticioStr
    }

    const templateFile =
      processType === ProcessType.PROMOCAO
        ? path.join(process.cwd(), "templates", "requerimento_promocao.docx")
        : path.join(process.cwd(), "templates", "requerimento_progressao.docx")

    const docxBuffer = renderDocxFromTemplate(templateFile, vars)
    const pdfBuffer = await convertDocxToPdf(docxBuffer)

    const base =
      processType === ProcessType.PROMOCAO
        ? "Requerimento_Promocao"
        : "Requerimento_Progressao"

    const filename =
      `${base}_${nomeProfessor.replace(/\s+/g, "_")}_` +
      `${dataEmissao.format("YYYYMMDD")}.pdf`

    return {
      filename,
      pdfBuffer
    }
  }

  // ---------- REGRAS DE NEGÓCIO PARA GERAR REQUERIMENTO ---------------------

  private validarRegrasDeRequerimento(careerProcess: any) {
    const processType: ProcessType = careerProcess.type
    const origemCodigo = `${careerProcess.classeOrigem}${careerProcess.nivelOrigem}`.toUpperCase()
    const destinoCodigo = `${careerProcess.classeDestino}${careerProcess.nivelDestino}`.toUpperCase()

    const mesesIntersticio = dayjs().diff(
      dayjs.utc(careerProcess.intersticeStart),
      "month"
    )

    this.validarCombinacaoProgressaoOuPromocao(
      processType,
      origemCodigo,
      destinoCodigo
    )

    if (processType === ProcessType.PROGRESSAO) {
      const regrasProgressao = [
        {
          from: "A1",
          to: "B1",
          minMonths: 36,
          descricao:
            "Só é permitida progressão de A1 para B1 com interstício mínimo de 36 meses."
        },
        {
          from: "B4",
          to: "C1",
          minMonths: 24,
          descricao:
            "Só é permitida progressão para C1 após permanecer no mínimo 24 meses em B4."
        },
        {
          from: "C4",
          to: "D1",
          minMonths: 24,
          descricao:
            "Só é permitida progressão para D1 após permanecer no mínimo 24 meses em C4."
        }
      ]

      const regra = regrasProgressao.find(
        r => r.from === origemCodigo && r.to === destinoCodigo
      )

      if (!regra) {
        throw new BusinessRuleError(
          `Combinação de progressão inválida: ${origemCodigo} → ${destinoCodigo}.`
        )
      }

      if (mesesIntersticio < regra.minMonths) {
        throw new BusinessRuleError(
          `${regra.descricao} Interstício atual: ${mesesIntersticio} meses.`
        )
      }

      return
    }

    if (processType === ProcessType.PROMOCAO) {
      const regrasPromocao = [
        {
          from: "B1",
          to: "B2",
          minMonths: 24,
          descricao:
            "Só é permitida promoção para B2 após permanecer no mínimo 24 meses em B1."
        },
        {
          from: "B2",
          to: "B3",
          minMonths: 24,
          descricao:
            "Só é permitida promoção para B3 após permanecer no mínimo 24 meses em B2."
        },
        {
          from: "B3",
          to: "B4",
          minMonths: 24,
          descricao:
            "Só é permitida promoção para B4 após permanecer no mínimo 24 meses em B3."
        },
        {
          from: "C1",
          to: "C2",
          minMonths: 24,
          descricao:
            "Só é permitida promoção para C2 após permanecer no mínimo 24 meses em C1."
        },
        {
          from: "C2",
          to: "C3",
          minMonths: 24,
          descricao:
            "Só é permitida promoção para C3 após permanecer no mínimo 24 meses em C2."
        },
        {
          from: "C3",
          to: "C4",
          minMonths: 24,
          descricao:
            "Só é permitida promoção para C4 após permanecer no mínimo 24 meses em C3."
        }
      ]

      const regra = regrasPromocao.find(
        r => r.from === origemCodigo && r.to === destinoCodigo
      )

      if (!regra) {
        throw new BusinessRuleError(
          `Combinação de promoção inválida: ${origemCodigo} → ${destinoCodigo}.`
        )
      }

      if (mesesIntersticio < regra.minMonths) {
        throw new BusinessRuleError(
          `${regra.descricao} Interstício atual: ${mesesIntersticio} meses.`
        )
      }

      return
    }
  }

  // ---------- VALIDAÇÃO DE COMBINAÇÃO PROGRESSÃO/PROMOÇÃO -------------------

  private validarCombinacaoProgressaoOuPromocao(
    processType: ProcessType,
    origemCodigo: string,
    destinoCodigo: string
  ) {
    if (processType === ProcessType.PROGRESSAO) {
      const combinacoesValidas = ["A1->B1", "B4->C1", "C4->D1"]

      const chave = `${origemCodigo}->${destinoCodigo}`

      if (!combinacoesValidas.includes(chave)) {
        throw new BusinessRuleError(
          `Combinação de progressão inválida: ${origemCodigo} → ${destinoCodigo}. ` +
          "As progressões permitidas são: A1→B1, B4→C1 e C4→D1."
        )
      }

      return
    }

    if (processType === ProcessType.PROMOCAO) {
      const combinacoesValidas = [
        "B1->B2",
        "B2->B3",
        "B3->B4",
        "C1->C2",
        "C2->C3",
        "C3->C4"
      ]

      const chave = `${origemCodigo}->${destinoCodigo}`

      if (!combinacoesValidas.includes(chave)) {
        throw new BusinessRuleError(
          `Combinação de promoção inválida: ${origemCodigo} → ${destinoCodigo}.`
        )
      }

      return
    }
  }

  // ---------- VALIDAÇÃO DE CLASSE/NÍVEL -------------------------------------

  private validarClasseENivel(
    classe: string,
    nivel: string,
    contexto: "origem" | "destino"
  ) {
    const codigo = `${classe}${nivel}`.toUpperCase()
    const valoresValidos = Object.values(ClassLevel)

    if (!valoresValidos.includes(codigo as ClassLevel)) {
      throw new BusinessRuleError(
        `Combinação de classe/nível de ${contexto} inválida: ${codigo}.`
      )
    }
  }

  // ---------- MAPEAMENTO PARA DTO DE RESPOSTA --------------------------------

  private mapProcessToDto(careerProcess: any) {
    return {
      processId: careerProcess.idProcess,
      type: careerProcess.type,
      status: careerProcess.status,
      scoringTableId: careerProcess.scoringTableId,
      createdAt: careerProcess.createdAt,
      userId: careerProcess.userId,
      campus: careerProcess.campus,
      cidadeUF: careerProcess.cidadeUF,
      intersticeStart: careerProcess.intersticeStart,
      intersticeEnd: careerProcess.intersticeEnd,
      classeOrigem: careerProcess.classeOrigem,
      nivelOrigem: careerProcess.nivelOrigem,
      classeDestino: careerProcess.classeDestino,
      nivelDestino: careerProcess.nivelDestino
    }
  }
  
}
