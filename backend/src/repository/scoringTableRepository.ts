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

  // criação da tabela
  async createTable(params: {
    name: string
    startsOn: Date | null
    endsOn: Date | null
  }) {
    return prisma.scoringTable.create({
      data: {
        name: params.name,
        startsOn: params.startsOn,
        endsOn: params.endsOn
      }
    })
  }

  // criação de um node (sem parentId definido ainda)
  async createNode(params: {
    scoringTableId: number
    name: string
    code?: string | null
    sortOrder?: number
    hasFormula?: boolean
    formulaExpression?: string | null
  }) {
    return prisma.scoringNode.create({
      data: {
        scoringTableId: params.scoringTableId,
        parentId: null,
        name: params.name,
        code: params.code ?? null,
        sortOrder: params.sortOrder ?? 0,
        active: true,
        hasFormula: params.hasFormula ?? false,
        formulaExpression: params.hasFormula ? params.formulaExpression ?? null : null
      }
    })
  }

  // definir parentId de um node
  async updateNodeParent(nodeId: number, parentId: number | null) {
    return prisma.scoringNode.update({
      where: {
        idScoringNode: nodeId
      },
      data: {
        parentId
      }
    })
  }

  // criação de item
  async createItem(params: {
    scoringTableId: number
    nodeId: number
    description: string
    unit?: string | null
    points: string
    hasMaxPoints?: boolean
    maxPoints?: string | null
    formulaKey?: string | null
  }) {
    return prisma.scoringItem.create({
      data: {
        scoringTableId: params.scoringTableId,
        nodeId: params.nodeId,
        description: params.description,
        unit: params.unit ?? null,
        points: params.points,
        hasMaxPoints: params.hasMaxPoints ?? false,
        maxPoints: params.hasMaxPoints ? params.maxPoints ?? null : null,
        active: true,
        formulaKey: params.formulaKey ?? null
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

  // nó específico
  async findNodeById(nodeId: number) {
    return prisma.scoringNode.findUnique({
      where: {
        idScoringNode: nodeId
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

  // itens de um nó específico
  async findItemsByNodeId(nodeId: number) {
    return prisma.scoringItem.findMany({
      where: {
        nodeId,
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
