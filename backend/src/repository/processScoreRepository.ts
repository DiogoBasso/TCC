// src/repository/processScoreRepository.ts
import { prisma } from "../infra/prismaClient"

export class ProcessScoreRepository {
  async findByProcessAndItem(processId: number, itemId: number) {
    return prisma.processScore.findUnique({
      where: {
        processId_itemId: {
          processId,
          itemId
        }
      },
      include: {
        evidenceFile: true,
        item: true
      }
    })
  }

  async upsertScore(
    processId: number,
    itemId: number,
    quantity: number,
    awardedPoints: string,
    evidenceFileId?: number | null
  ) {
    return prisma.processScore.upsert({
      where: {
        processId_itemId: {
          processId,
          itemId
        }
      },
      create: {
        processId,
        itemId,
        quantity,
        awardedPoints,
        evidenceFileId: evidenceFileId ?? null
      },
      update: {
        quantity,
        awardedPoints,
        evidenceFileId: evidenceFileId ?? undefined
      },
      include: {
        evidenceFile: true,
        item: true
      }
    })
  }

  async listByProcess(processId: number) {
    return prisma.processScore.findMany({
      where: {
        processId,
        deletedDate: null
      },
      include: {
        evidenceFile: true,
        item: {
          include: {
            node: true
          }
        }
      },
      orderBy: {
        idProcessScore: "asc"
      }
    })
  }

  // scores de um nó específico
  async listByProcessAndNode(processId: number, nodeId: number) {
    return prisma.processScore.findMany({
      where: {
        processId,
        deletedDate: null,
        item: {
          nodeId
        }
      },
      include: {
        item: true,
        evidenceFile: true
      },
      orderBy: {
        idProcessScore: "asc"
      }
    })
  }

  async updateEvidence(processId: number, itemId: number, evidenceFileId: number | null) {
    return prisma.processScore.update({
      where: {
        processId_itemId: {
          processId,
          itemId
        }
      },
      data: {
        evidenceFileId
      },
      include: {
        evidenceFile: true,
        item: true
      }
    })
  }

  // ✅ Soma de todos os pontos lançados no processo (awardedPoints)
  async sumTotalAwardedPointsByProcess(processId: number): Promise<number> {
    const result = await prisma.processScore.aggregate({
      where: {
        processId,
        deletedDate: null
      },
      _sum: {
        awardedPoints: true
      }
    })

    const raw = result._sum.awardedPoints

    if (raw === null || raw === undefined) {
      return 0
    }

    // Prisma.Decimal ou number
    if (typeof raw === "object" && typeof (raw as any).toNumber === "function") {
      return (raw as any).toNumber()
    }

    const num = Number(raw)
    return Number.isNaN(num) ? 0 : num
  }
}
