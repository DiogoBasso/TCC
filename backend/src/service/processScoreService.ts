import { ProcessStatus } from "@prisma/client"
import path from "path"
import fs from "fs"
import { convertImageToPdf } from "../util/imageToPdf"
import { ProcessRepository } from "../repository/processoRepository"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { ProcessScoreRepository } from "../repository/processScoreRepository"
import { EvidenceFileRepository } from "../repository/evidenceFileRepository"
import { ProcessNodeScoreRepository } from "../repository/processNodeScoreRepository"
import { UpdateItemScoreDto } from "../type/dto/processScoreDto"
import { BusinessRuleError, NotFoundError } from "./processoService"

function decimalToNumber(value: any): number {
  if (value === null || value === undefined) return NaN
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber()
  }
  return Number(value)
}

function evaluateNodeFormula(
  formulaExpression: string,
  variables: Record<string, number>
): number {
  try {
    const argNames = Object.keys(variables)
    const argValues = Object.values(variables)

    const fn = new Function(
      ...argNames,
      `return ${formulaExpression};`
    ) as (...args: number[]) => number

    const result = fn(...argValues)
    const num = Number(result)

    if (!Number.isFinite(num)) {
      throw new Error("Resultado não numérico")
    }

    return num
  } catch (err) {
    console.error("Erro ao avaliar fórmula do nó:", err)
    throw new BusinessRuleError(
      "Fórmula de cálculo inválida para o bloco de pontuação."
    )
  }
}

export class ProcessScoreService {
  constructor(
    private readonly processRepo: ProcessRepository,
    private readonly tableRepo: ScoringTableRepository,
    private readonly scoreRepo: ProcessScoreRepository,
    private readonly evidenceFileRepo: EvidenceFileRepository,
    private readonly nodeScoreRepo: ProcessNodeScoreRepository
  ) {}

  // lista a estrutura da tabela + pontuações do processo + total de cada nó
  async listarEstruturaPontuacao(processId: number, userId: number) {
    const process = await this.processRepo.findById(processId)
    if (!process || process.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (process.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    const tableId = process.scoringTableId

    const [nodes, items, scores, nodeScores] = await Promise.all([
      this.tableRepo.findNodesByTableId(tableId),
      this.tableRepo.findItemsByTableId(tableId),
      this.scoreRepo.listByProcess(processId),
      this.nodeScoreRepo.listByProcess(processId)
    ])

    const scoreByItemId = new Map<number, any>()
    scores.forEach(score => {
      scoreByItemId.set(score.itemId, score)
    })

    const nodeScoreByNodeId = new Map<number, any>()
    nodeScores.forEach(ns => {
      nodeScoreByNodeId.set(ns.nodeId, ns)
    })

    const itemsByNodeId = new Map<number, any[]>()

    items.forEach(item => {
      const nodeId = item.nodeId
      const existing = itemsByNodeId.get(nodeId) ?? []

      const score = scoreByItemId.get(item.idScoringItem)

      const evidences =
        score && score.evidenceFile
          ? [
              {
                evidenceFileId: score.evidenceFile.idEvidenceFile,
                originalName: score.evidenceFile.originalName,
                url: score.evidenceFile.url,
                mimeType: score.evidenceFile.mimeType,
                sizeBytes:
                  score.evidenceFile.sizeBytes != null
                    ? Number(score.evidenceFile.sizeBytes)
                    : null
              }
            ]
          : []

      existing.push({
        itemId: item.idScoringItem,
        description: item.description,
        unit: item.unit,
        points: item.points,
        hasMaxPoints: item.hasMaxPoints,
        maxPoints: item.maxPoints,
        active: item.active,
        formulaKey: item.formulaKey,
        currentScore: score
          ? {
              processScoreId: score.idProcessScore,
              quantity: score.quantity,
              awardedPoints: score.awardedPoints,
              evidences
            }
          : null
      })

      itemsByNodeId.set(nodeId, existing)
    })

    const blocks = nodes.map(node => {
      const nodeScore = nodeScoreByNodeId.get(node.idScoringNode)

      return {
        nodeId: node.idScoringNode,
        name: node.name,
        code: node.code,
        parentId: node.parentId,
        sortOrder: node.sortOrder,
        hasFormula: node.hasFormula,
        totalPoints: nodeScore
          ? decimalToNumber(nodeScore.totalPoints)
          : null,
        items: itemsByNodeId.get(node.idScoringNode) ?? []
      }
    })

    return {
      processId: process.idProcess,
      scoringTableId: tableId,
      type: process.type,
      status: process.status,
      blocks
    }
  }

  // salvar/atualizar pontuação de um item
  async salvarPontuacaoItem(
    processId: number,
    userId: number,
    itemId: number,
    dto: UpdateItemScoreDto
  ) {
    const process = await this.processRepo.findById(processId)
    if (!process || process.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (process.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (
      process.status !== ProcessStatus.DRAFT &&
      process.status !== ProcessStatus.RETURNED &&
      process.status !== ProcessStatus.REJECTED
    ) {
      throw new BusinessRuleError(
        "Só é permitido alterar pontuações de processos nos status DRAFT, RETURNED ou REJECTED."
      )
    }

    const item = await this.tableRepo.findItemById(itemId)
    if (!item || item.deletedDate || !item.active) {
      throw new NotFoundError("Item de pontuação não encontrado")
    }

    if (item.scoringTableId !== process.scoringTableId) {
      throw new BusinessRuleError(
        "Item de pontuação não pertence à tabela vinculada a este processo."
      )
    }

    const nodeId = item.nodeId

    const existingScore = await this.scoreRepo.findByProcessAndItem(
      processId,
      itemId
    )

    const rawQuantity = dto.quantity ?? 0
    let finalQuantity = rawQuantity
    let finalPointsNumber = 0

    // ✅ Agora TODOS os itens (inclusive dentro de bloco com fórmula)
    // calculam pontos normalmente antes da fórmula do bloco
    if (!item.hasMaxPoints) {
      const quantityNumber = Number(rawQuantity)

      if (Number.isNaN(quantityNumber) || quantityNumber < 0) {
        throw new BusinessRuleError(
          "A quantidade deve ser um número maior ou igual a zero."
        )
      }

      const basePoints = decimalToNumber(item.points)
      if (Number.isNaN(basePoints)) {
        throw new BusinessRuleError(
          "Configuração de pontos inválida para este item."
        )
      }

      finalQuantity = quantityNumber
      finalPointsNumber = quantityNumber * basePoints
    } else {
      if (
        dto.awardedPoints === undefined ||
        dto.awardedPoints === null ||
        dto.awardedPoints === ""
      ) {
        throw new BusinessRuleError(
          "Informe a pontuação para este item (até o máximo permitido)."
        )
      }

      const requested = Number(dto.awardedPoints)
      if (Number.isNaN(requested) || requested < 0) {
        throw new BusinessRuleError(
          "A pontuação deve ser um número maior ou igual a zero."
        )
      }

      let maxAllowed = NaN
      if (item.maxPoints != null) {
        maxAllowed = decimalToNumber(item.maxPoints)
      } else {
        maxAllowed = decimalToNumber(item.points)
      }

      if (!Number.isNaN(maxAllowed) && requested > maxAllowed) {
        throw new BusinessRuleError(
          `Pontuação informada (${requested}) excede o máximo permitido (${maxAllowed}) para este item.`
        )
      }

      finalQuantity = rawQuantity ?? 0
      finalPointsNumber = requested
    }

    const awardedPoints = finalPointsNumber.toFixed(2)

    const evidenceFileId = existingScore?.evidenceFileId ?? null
    const hasEvidence = evidenceFileId !== null
    const isNonZeroScore = finalPointsNumber > 0

    // ✅ Agora QUALQUER item com pontuação > 0 precisa de comprovante
    if (isNonZeroScore && !hasEvidence) {
      throw new BusinessRuleError(
        "Não é permitido lançar pontuação neste item sem anexar pelo menos um documento de comprovação."
      )
    }

    const score = await this.scoreRepo.upsertScore(
      processId,
      itemId,
      finalQuantity,
      awardedPoints,
      evidenceFileId
    )

    // recalcula o total do nó (bloco), incluindo fórmulas
    await this.recalcularPontuacaoDoNo(processId, nodeId)

    return {
      processId: score.processId,
      itemId: score.itemId,
      processScoreId: score.idProcessScore,
      quantity: score.quantity,
      awardedPoints: score.awardedPoints,
      evidence:
        score.evidenceFile != null
          ? {
              evidenceFileId: score.evidenceFileId,
              originalName: score.evidenceFile.originalName,
              url: score.evidenceFile.url,
              mimeType: score.evidenceFile.mimeType,
              sizeBytes:
                score.evidenceFile.sizeBytes != null
                  ? Number(score.evidenceFile.sizeBytes)
                  : null
            }
          : null
    }
  }

  private async recalcularPontuacaoDoNo(processId: number, nodeId: number) {
    const node = await this.tableRepo.findNodeById(nodeId)
    if (!node || node.deletedDate || !node.active) {
      return
    }

    const items = await this.tableRepo.findItemsByNodeId(nodeId)
    const scores = await this.scoreRepo.listByProcessAndNode(processId, nodeId)

    const scoreByItemId = new Map<number, (typeof scores)[number]>()
    scores.forEach(score => {
      scoreByItemId.set(score.itemId, score)
    })

    let totalPointsNumber = 0

    if (!node.hasFormula || !node.formulaExpression) {
      // ✅ nó normal: soma dos pontos dos itens
      items.forEach(item => {
        const score = scoreByItemId.get(item.idScoringItem)
        if (score) {
          const pts = decimalToNumber(score.awardedPoints)
          if (!Number.isNaN(pts)) {
            totalPointsNumber += pts
          }
        }
      })
    } else {
      // ✅ nó com fórmula: usa os PONTOS dos itens (awardPoints) nas variáveis
      const variables: Record<string, number> = {}

      items.forEach(item => {
        if (!item.formulaKey) {
          return
        }

        const score = scoreByItemId.get(item.idScoringItem)
        const rawValue = score ? score.awardedPoints : 0
        const val = decimalToNumber(rawValue)

        variables[item.formulaKey] = Number.isNaN(val) ? 0 : val
      })

      totalPointsNumber = evaluateNodeFormula(
        node.formulaExpression,
        variables
      )
    }

    const totalPoints = totalPointsNumber.toFixed(2)

    await this.nodeScoreRepo.upsertNodeScore(processId, nodeId, totalPoints)
  }

  async anexarEvidencia(params: {
    processId: number
    userId: number
    itemId: number
    originalName: string
    storedName: string
    filePath: string
    webBasePath: string
    mimeType?: string | null
    sizeBytes?: number | null
  }) {
    const { processId, userId, itemId } = params

    const process = await this.processRepo.findById(processId)
    if (!process || process.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (process.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (
      process.status !== ProcessStatus.DRAFT &&
      process.status !== ProcessStatus.RETURNED &&
      process.status !== ProcessStatus.REJECTED
    ) {
      throw new BusinessRuleError(
        "Só é permitido anexar comprovações em processos nos status DRAFT, RETURNED ou REJECTED."
      )
    }

    const item = await this.tableRepo.findItemById(itemId)
    if (!item || item.deletedDate || !item.active) {
      throw new NotFoundError("Item de pontuação não encontrado")
    }

    if (item.scoringTableId !== process.scoringTableId) {
      throw new BusinessRuleError(
        "Item de pontuação não pertence à tabela vinculada a este processo."
      )
    }

    let score = await this.scoreRepo.findByProcessAndItem(processId, itemId)

    if (!score) {
      score = await this.scoreRepo.upsertScore(processId, itemId, 0, "0.00", null)
    }

    const isImage = params.mimeType?.startsWith("image/") ?? false

    let finalStoredName = params.storedName
    let finalMimeType = params.mimeType ?? null
    let finalSizeBytes = params.sizeBytes ?? null
    let finalUrl: string

    if (isImage) {
      const dir = path.dirname(params.filePath)
      const base = path.basename(params.storedName, path.extname(params.storedName))
      const pdfName = `${base}.pdf`
      const pdfPath = path.join(dir, pdfName)

      await convertImageToPdf(params.filePath, pdfPath)

      const stat = fs.statSync(pdfPath)

      try {
        fs.unlinkSync(params.filePath)
      } catch (e) {
        console.warn("Falha ao remover imagem original:", e)
      }

      finalStoredName = pdfName
      finalMimeType = "application/pdf"
      finalSizeBytes = stat.size
      finalUrl = `${params.webBasePath}/${pdfName}`
    } else {
      finalUrl = `${params.webBasePath}/${params.storedName}`
    }

    const file = await this.evidenceFileRepo.create({
      userId,
      originalName: params.originalName,
      storedName: finalStoredName,
      url: finalUrl,
      mimeType: finalMimeType,
      sizeBytes: finalSizeBytes ?? undefined
    })

    const updatedScore = await this.scoreRepo.updateEvidence(
      processId,
      itemId,
      file.idEvidenceFile
    )

    return {
      processScoreId: updatedScore.idProcessScore,
      itemId: updatedScore.itemId,
      evidence: {
        evidenceFileId: file.idEvidenceFile,
        originalName: file.originalName,
        url: file.url,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes != null ? Number(file.sizeBytes) : null
      }
    }
  }

  async vincularEvidenciaExistente(params: {
    processId: number
    userId: number
    itemId: number
    evidenceFileId: number
  }) {
    const { processId, userId, itemId, evidenceFileId } = params

    const process = await this.processRepo.findById(processId)
    if (!process || process.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (process.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (
      process.status !== ProcessStatus.DRAFT &&
      process.status !== ProcessStatus.RETURNED &&
      process.status !== ProcessStatus.REJECTED
    ) {
      throw new BusinessRuleError(
        "Só é permitido vincular comprovações em processos nos status DRAFT, RETURNED ou REJECTED."
      )
    }

    const file = await this.evidenceFileRepo.findById(evidenceFileId)
    if (!file || file.deletedDate) {
      throw new NotFoundError("Arquivo de evidência não encontrado")
    }

    if (file.userId !== userId) {
      throw new BusinessRuleError("Você não tem permissão para usar este arquivo")
    }

    const item = await this.tableRepo.findItemById(itemId)
    if (!item || item.deletedDate || !item.active) {
      throw new NotFoundError("Item de pontuação não encontrado")
    }

    if (item.scoringTableId !== process.scoringTableId) {
      throw new BusinessRuleError(
        "Item de pontuação não pertence à tabela vinculada a este processo."
      )
    }

    let score = await this.scoreRepo.findByProcessAndItem(processId, itemId)

    if (!score) {
      score = await this.scoreRepo.upsertScore(processId, itemId, 0, "0.00", evidenceFileId)
    } else {
      score = await this.scoreRepo.updateEvidence(processId, itemId, evidenceFileId)
    }

    return {
      processScoreId: score.idProcessScore,
      itemId: score.itemId,
      evidence: {
        evidenceFileId: file.idEvidenceFile,
        originalName: file.originalName,
        url: file.url,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes != null ? Number(file.sizeBytes) : null
      }
    }
  }

  async listarArquivosDoUsuario(userId: number) {
    const files = await this.evidenceFileRepo.listByUser(userId)

    return files.map(file => ({
      evidenceFileId: file.idEvidenceFile,
      originalName: file.originalName,
      url: file.url,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes != null ? Number(file.sizeBytes) : null,
      uploadedAt: file.uploadedAt
    }))
  }

  async obterEvidenciaConteudo(evidenceFileId: number, userId: number) {
    const file = await this.evidenceFileRepo.findById(evidenceFileId)

    if (!file || file.deletedDate) {
      throw new NotFoundError("Arquivo de evidência não encontrado")
    }

    if (file.userId !== userId) {
      throw new BusinessRuleError(
        "Você não tem permissão para acessar este arquivo de evidência."
      )
    }

    if (!file.url || !file.url.startsWith("/uploads/")) {
      throw new BusinessRuleError(
        "Caminho do arquivo de evidência inválido."
      )
    }

    const uploadsRoot = path.join(process.cwd(), "uploads")
    const relativePath = file.url.replace("/uploads/", "")
    const filePath = path.join(uploadsRoot, relativePath)

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError("Arquivo de evidência não encontrado no servidor.")
    }

    return {
      filePath,
      originalName: file.originalName,
      mimeType: file.mimeType ?? "application/pdf"
    }
  }
}
