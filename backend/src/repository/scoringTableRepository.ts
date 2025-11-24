import { prisma } from "../infra/prismaClient"

export class ScoringTableRepository {
  // tabela de pontuação vigente em uma data de referência
  async findVigente(referenceDate: Date) {
    return prisma.scoringTable.findFirst({
      where: {
        deletedDate: null,
        AND: [
          {
            OR: [
              { startsOn: null },
              { startsOn: { lte: referenceDate } }
            ]
          },
          {
            OR: [
              { endsOn: null },
              { endsOn: { gte: referenceDate } }
            ]
          }
        ]
      },
      orderBy: {
        startsOn: "desc"
      }
    })
  }

  // todos os nodes (blocos) da tabela, ativos, sem deletados
  async findNodesByTableId(scoringTableId: number) {
    return prisma.scoringNode.findMany({
      where: {
        scoringTableId,
        deletedDate: null,
        active: true
      },
      orderBy: {
        sortOrder: "asc"
      }
    })
  }

  // todos os itens de pontuação da tabela, ativos, sem deletados
  async findItemsByTableId(scoringTableId: number) {
    return prisma.scoringItem.findMany({
      where: {
        scoringTableId,
        deletedDate: null,
        active: true
      },
      orderBy: {
        idScoringItem: "asc"
      }
    })
  }

  // buscar um item específico da tabela pelo id
  async findItemById(itemId: number) {
    return prisma.scoringItem.findUnique({
      where: {
        idScoringItem: itemId
      },
      include: {
        table: true
      }
    })
  }
}
