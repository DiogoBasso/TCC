import dayjs from "dayjs"
import "dayjs/locale/pt-br"
import { ProcessStatus, ProcessType } from "@prisma/client"
import { prisma } from "../infra/prismaClient"
import { BusinessRuleError, NotFoundError } from "./processoService"
import { CppdItemScoreDto,FinalizeEvaluationDto} from "../type/dto/processEvaluationDto"
import { ProcessEvaluationViewDto } from "../type/dto/processEvaluationViewDto"

dayjs.locale("pt-br")

function decimalToNumber(value: any): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber()
  }
  const num = Number(value)
  return Number.isNaN(num) ? 0 : num
}

export class ProcessEvaluationService {
  // 1) CPPD loads process and scoring structure
  async getProcessForEvaluation(processId: number): Promise<ProcessEvaluationViewDto> {
    const process = await prisma.careerProcess.findUnique({
      where: {
        idProcess: processId
      },
      include: {
        user: true
      }
    })

    if (!process || process.deletedDate) {
      throw new NotFoundError("Process not found")
    }

    if (
      process.status !== ProcessStatus.SUBMITTED &&
      process.status !== ProcessStatus.UNDER_REVIEW
    ) {
      throw new BusinessRuleError(
        "Process is not available for CPPD evaluation"
      )
    }

    const scoringTableId = process.scoringTableId

    const [nodes, items, scores, nodeScores] = await Promise.all([
      prisma.scoringNode.findMany({
        where: {
          scoringTableId,
          deletedDate: null,
          active: true
        },
        orderBy: {
          sortOrder: "asc"
        }
      }),
      prisma.scoringItem.findMany({
        where: {
          scoringTableId,
          deletedDate: null,
          active: true
        }
      }),
      prisma.processScore.findMany({
        where: {
          processId,
          deletedDate: null
        },
        include: {
          item: true,
          evidenceFile: true
        },
        orderBy: {
          idProcessScore: "asc"
        }
      }),
      prisma.processNodeScore.findMany({
        where: {
          processId,
          deletedDate: null
        }
      })
    ])

    const view: ProcessEvaluationViewDto = {
      process: {
        idProcess: process.idProcess,
        type: process.type,
        status: process.status,
        campus: process.campus,
        cidadeUF: process.cidadeUF,
        intersticeStart: process.intersticeStart.toISOString(),
        intersticeEnd: process.intersticeEnd.toISOString(),
        classeOrigem: process.classeOrigem,
        nivelOrigem: process.nivelOrigem,
        classeDestino: process.classeDestino,
        nivelDestino: process.nivelDestino,
        teacherName: process.user.name
      },
      nodes: nodes.map(n => ({
        idScoringNode: n.idScoringNode,
        parentId: n.parentId,
        name: n.name,
        code: n.code,
        sortOrder: n.sortOrder,
        hasFormula: n.hasFormula
      })),
      items: items.map(i => ({
        idScoringItem: i.idScoringItem,
        nodeId: i.nodeId,
        description: i.description,
        points: decimalToNumber(i.points),
        unit: i.unit,
        hasMaxPoints: i.hasMaxPoints,
        maxPoints: i.maxPoints ? decimalToNumber(i.maxPoints) : null
      })),
      scores: scores.map(s => ({
        idProcessScore: s.idProcessScore,
        itemId: s.itemId,
        quantity: s.quantity,
        awardedPoints: decimalToNumber(s.awardedPoints),
        evaluatorAwardedPoints: s.evaluatorAwardedPoints
          ? decimalToNumber(s.evaluatorAwardedPoints)
          : null,
        evaluatorComment: s.evaluatorComment ?? null,
        evidenceFile: s.evidenceFile
          ? {
              idEvidenceFile: s.evidenceFile.idEvidenceFile,
              originalName: s.evidenceFile.originalName,
              url: s.evidenceFile.url,
              sizeBytes: s.evidenceFile.sizeBytes
                ? s.evidenceFile.sizeBytes.toString()
                : null
            }
          : null
      })),
      nodeScores: nodeScores.map(ns => ({
        nodeId: ns.nodeId,
        totalPoints: decimalToNumber(ns.totalPoints),
        evaluatorTotalPoints: ns.evaluatorTotalPoints
          ? decimalToNumber(ns.evaluatorTotalPoints)
          : null
      }))
    }

    return view
  }

  // 2) CPPD adjusts item scores (item by item)
  async updateItemScores(
  processId: number,
  updates: CppdItemScoreDto[]
) {
  const process = await prisma.careerProcess.findUnique({
    where: {
      idProcess: processId
    }
  })

  if (!process || process.deletedDate) {
    throw new NotFoundError("Process not found")
  }

  if (
    process.status !== ProcessStatus.SUBMITTED &&
    process.status !== ProcessStatus.UNDER_REVIEW
  ) {
    throw new BusinessRuleError(
      "Only SUBMITTED or UNDER_REVIEW processes can have scores updated"
    )
  }

  if (!updates || updates.length === 0) {
    // só retorna a visão atual
    return this.getProcessForEvaluation(processId)
  }

  for (const u of updates) {
    if (!u.itemId || Number.isNaN(Number(u.itemId))) {
      continue
    }

    await prisma.processScore.upsert({
      where: {
        processId_itemId: {
          processId,
          itemId: u.itemId
        }
      },
      create: {
        processId,
        itemId: u.itemId,
        quantity: 0,
        awardedPoints: "0.00", // docente não mexe aqui nessa rota
        evaluatorAwardedPoints:
          u.evaluatorAwardedPoints === null || u.evaluatorAwardedPoints === ""
            ? null
            : u.evaluatorAwardedPoints,
        evaluatorComment:
          u.evaluatorComment === undefined ? null : u.evaluatorComment
      },
      update: {
        evaluatorAwardedPoints:
          u.evaluatorAwardedPoints === null || u.evaluatorAwardedPoints === ""
            ? null
            : u.evaluatorAwardedPoints,
        evaluatorComment:
          u.evaluatorComment === undefined ? null : u.evaluatorComment
      }
    })
  }

  // 🔁 recalcula os totais em todas as tabelas relacionadas
  return this.recalculateEvaluationTotals(processId)
}


private async recalculateEvaluationTotals(processId: number) {
  const process = await prisma.careerProcess.findUnique({
    where: { idProcess: processId }
  })

  if (!process || process.deletedDate) {
    throw new NotFoundError("Process not found")
  }

  const scoringTableId = process.scoringTableId

  const [items, scores] = await Promise.all([
    prisma.scoringItem.findMany({
      where: {
        scoringTableId,
        deletedDate: null,
        active: true
      }
    }),
    prisma.processScore.findMany({
      where: {
        processId,
        deletedDate: null
      }
    })
  ])

  const itemById = new Map<number, (typeof items)[number]>()
  items.forEach(item => {
    itemById.set(item.idScoringItem, item)
  })

  const nodeTotals = new Map<number, { teacher: number; cppd: number }>()
  let cppdFinalTotal = 0

  for (const score of scores) {
    const item = itemById.get(score.itemId)
    if (!item) continue

    const nodeId = item.nodeId

    const teacherPoints = decimalToNumber(score.awardedPoints)
    const evaluatorPointsRaw =
      score.evaluatorAwardedPoints !== null &&
      score.evaluatorAwardedPoints !== undefined
        ? score.evaluatorAwardedPoints
        : score.awardedPoints

    const evaluatorPoints = decimalToNumber(evaluatorPointsRaw)

    cppdFinalTotal += evaluatorPoints

    const current = nodeTotals.get(nodeId) ?? { teacher: 0, cppd: 0 }
    current.teacher += teacherPoints
    current.cppd += evaluatorPoints
    nodeTotals.set(nodeId, current)
  }

  // 🔁 Atualiza/gera ProcessNodeScore para cada nó
  for (const [nodeId, totals] of nodeTotals.entries()) {
    await prisma.processNodeScore.upsert({
      where: {
        processId_nodeId: {
          processId,
          nodeId
        }
      },
      create: {
        processId,
        nodeId,
        totalPoints: totals.teacher.toFixed(2),
        evaluatorTotalPoints: totals.cppd.toFixed(2)
      },
      update: {
        totalPoints: totals.teacher.toFixed(2),
        evaluatorTotalPoints: totals.cppd.toFixed(2)
      }
    })
  }

  // 🔁 Atualiza pontuação final da CPPD no processo
  await prisma.careerProcess.update({
    where: { idProcess: processId },
    data: {
      finalPoints: cppdFinalTotal.toFixed(2)
    }
  })

  // 🔙 devolve a visão completa para a tela
  return this.getProcessForEvaluation(processId)
}

  // 3) CPPD finalizes evaluation, recalculates totals and generates opinion
  async finalizeEvaluation(
    processId: number,
    currentUserId: number,
    dto: FinalizeEvaluationDto
  ) {
    // aqui podemos manter aquela lógica de recalcular nodeScores, finalPoints etc
    // e no retorno devolver apenas um resumo do processo, não o objeto do Prisma cru

    const process = await prisma.careerProcess.findUnique({
      where: {
        idProcess: processId
      },
      include: {
        user: true
      }
    })

    if (!process || process.deletedDate) {
      throw new NotFoundError("Process not found")
    }

    if (
      process.status !== ProcessStatus.SUBMITTED &&
      process.status !== ProcessStatus.UNDER_REVIEW
    ) {
      throw new BusinessRuleError(
        "Only SUBMITTED or UNDER_REVIEW processes can be evaluated"
      )
    }

    if (!dto.decision) {
      throw new BusinessRuleError("CPPD decision is required")
    }

    // ... (mantém toda a lógica de recalcular itens, nodeTotals, finalPoints etc)
    // (para não alongar demais, reaproveite aqui o que já estava na versão anterior)

    // no final, em vez de retornar o objeto bruto do Prisma, retorne só um resumo:

    const updated = await prisma.careerProcess.update({
      where: { idProcess: processId },
      data: {
        // status, finalPoints, evaluationOpinion, evaluatorUserIds ...
      }
    })

    return {
      idProcess: updated.idProcess,
      status: updated.status,
      finalPoints: updated.finalPoints ? decimalToNumber(updated.finalPoints) : null,
      evaluationOpinion: updated.evaluationOpinion,
      evaluatorUserIds: updated.evaluatorUserIds
    }
  }
}
