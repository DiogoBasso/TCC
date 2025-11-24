import { prisma } from "../infra/prismaClient"
import { ProcessStatus, ProcessType } from "@prisma/client"
import { AberturaProcessoDto } from "../type/dto/processoDto"

export class ProcessRepository {
  async create(
    userId: number,
    scoringTableId: number,
    processType: ProcessType,
    dto: AberturaProcessoDto
  ) {
    console.log("ProcessRepository.create =>", {
      userId,
      scoringTableId,
      processType
    })

    return prisma.careerProcess.create({
      data: {
        userId,
        scoringTableId,
        type: processType,
        status: ProcessStatus.DRAFT,

        campus: dto.campus,
        cidadeUF: dto.cidadeUF,
        intersticeStart: new Date(dto.intersticioInicioISO),
        intersticeEnd: new Date(dto.intersticioFimISO),
        classeOrigem: dto.classeOrigem,
        nivelOrigem: dto.nivelOrigem,
        classeDestino: dto.classeDestino,
        nivelDestino: dto.nivelDestino
      },
      include: {
        user: true,
        table: true
      }
    })
  }

  async findById(idProcess: number) {
    return prisma.careerProcess.findUnique({
      where: {
        idProcess
      },
      include: {
        user: true,
        table: true
      }
    })
  }

  /**
   * Verifica se o usuário já possui ALGUM processo em andamento
   * (progressão ou promoção) que ainda não foi aprovado nem excluído.
   *
   * Considera status:
   *   DRAFT, SUBMITTED, UNDER_REVIEW, RETURNED, REJECTED
   * e deletedDate = null.
   */
  async findAnyActiveProcessForUser(userId: number) {
    const activeStatuses: ProcessStatus[] = [
      ProcessStatus.DRAFT,
      ProcessStatus.SUBMITTED,
      ProcessStatus.UNDER_REVIEW,
      ProcessStatus.RETURNED,
      ProcessStatus.REJECTED
    ]

    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: {
          in: activeStatuses
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  }

  /**
   * Retorna o ÚLTIMO processo aprovado do usuário,
   * ordenado por intersticeEnd desc (maior fim de interstício).
   *
   * Usado para garantir que o próximo processo sempre seja
   * posterior ao último interstício aprovado.
   */
  async findLastApprovedProcessForUser(userId: number) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: ProcessStatus.APPROVED
      },
      orderBy: {
        intersticeEnd: "desc"
      }
    })
  }

  /**
   * Verifica se já existe um processo APROVADO para o mesmo usuário
   * com EXATAMENTE o mesmo interstício (início e fim),
   * independentemente do tipo (PROGRESSAO/PROMOCAO) e da movimentação.
   *
   * Se ignoreProcessId for passado, ignora esse processo (útil na edição).
   */
  async findApprovedByInterstice(
    userId: number,
    intersticeStart: Date,
    intersticeEnd: Date,
    ignoreProcessId?: number
  ) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: ProcessStatus.APPROVED,
        intersticeStart,
        intersticeEnd,
        ...(ignoreProcessId
          ? {
              idProcess: {
                not: ignoreProcessId
              }
            }
          : {})
      }
    })
  }

  /**
   * Verifica se já existe um processo APROVADO para o mesmo usuário
   * com a MESMA movimentação (tipo + origem + destino),
   * independentemente do interstício.
   *
   * Ex:
   *  - PROMOCAO B1->B2 já aprovada => nunca mais pode abrir PROMOCAO B1->B2
   *  - PROGRESSAO A1->B1 já aprovada => nunca mais pode abrir PROGRESSAO A1->B1
   */
  async findApprovedByMovement(
    userId: number,
    processType: ProcessType,
    classeOrigem: string,
    nivelOrigem: string,
    classeDestino: string,
    nivelDestino: string,
    ignoreProcessId?: number
  ) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: ProcessStatus.APPROVED,
        type: processType,
        classeOrigem,
        nivelOrigem,
        classeDestino,
        nivelDestino,
        ...(ignoreProcessId
          ? {
              idProcess: {
                not: ignoreProcessId
              }
            }
          : {})
      }
    })
  }

  /**
   * Verifica se já existe processo do mesmo usuário
   * com interstício que SE SOBREPÕE ao intervalo informado.
   *
   * Regra de sobreposição:
   *   existingStart <= newEnd AND existingEnd >= newStart
   *
   * Se ignoreProcessId for passado, ignora esse processo (útil na edição).
   */
  async findByUserAndInterstice(
    userId: number,
    intersticeStart: Date,
    intersticeEnd: Date,
    ignoreProcessId?: number
  ) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        intersticeStart: {
          lte: intersticeEnd
        },
        intersticeEnd: {
          gte: intersticeStart
        },
        ...(ignoreProcessId
          ? {
              idProcess: {
                not: ignoreProcessId
              }
            }
          : {})
      }
    })
  }

  async softDelete(idProcess: number) {
    return prisma.careerProcess.update({
      where: {
        idProcess
      },
      data: {
        deletedDate: new Date()
      },
      include: {
        user: true,
        table: true
      }
    })
  }

  async updateProcess(
    idProcess: number,
    data: {
      campus?: string
      cidadeUF?: string
      intersticeStart?: Date
      intersticeEnd?: Date
      classeOrigem?: string
      nivelOrigem?: string
      classeDestino?: string
      nivelDestino?: string
    }
  ) {
    return prisma.careerProcess.update({
      where: {
        idProcess
      },
      data,
      include: {
        user: true,
        table: true
      }
    })
  }

  async listByUser(userId: number, statuses?: ProcessStatus[]) {
    return prisma.careerProcess.findMany({
      where: {
        userId,
        deletedDate: null,
        ...(statuses && statuses.length
          ? {
              status: {
                in: statuses
              }
            }
          : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        user: true,
        table: true
      }
    })
  }
}
