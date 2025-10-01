import { Prisma, PrismaClient } from "@prisma/client"
// ou: import { prisma } from "../src/infra/prismaClient"
const prisma = new PrismaClient()

class Seeds {
  async main() {
    await this.clear()

    const table = await this.createScoringTable("Tabela EBTT 2025", "2025-01-01")

    // raízes
    const ensino = await this.createNode(table.idScoringTable, null, "Atividades de Ensino", 1)
    const pesquisa = await this.createNode(table.idScoringTable, null, "Atividades de Pesquisa", 2)
    const administrativas = await this.createNode(table.idScoringTable, null, "Atividades Administrativas", 3)

    // filhos de Ensino
    const aulas = await this.createNode(table.idScoringTable, ensino.idScoringNode, "Ministração de aulas", 1)
    const orientacoes = await this.createNode(table.idScoringTable, ensino.idScoringNode, "Orientações", 2)
    const estagio = await this.createNode(table.idScoringTable, ensino.idScoringNode, "Supervisão de estágio", 3)

    // filhos de Pesquisa
    const publicacoes = await this.createNode(table.idScoringTable, pesquisa.idScoringNode, "Publicações", 1)
    const projetos = await this.createNode(table.idScoringTable, pesquisa.idScoringNode, "Projetos de pesquisa", 2)

    // filhos de Administrativas
    const bancas = await this.createNode(table.idScoringTable, administrativas.idScoringNode, "Bancas e comissões", 1)

    // itens por unidade (hasMaxPoints = false)
    await this.createItem(table.idScoringTable, aulas.idScoringNode,        "Hora-aula presencial",                 "1.50", false, "hora")
    await this.createItem(table.idScoringTable, orientacoes.idScoringNode,  "Orientação de TCC concluída",          "5.00", false, "orientação")
    await this.createItem(table.idScoringTable, estagio.idScoringNode,      "Supervisão de estágio (por semestre)", "2.00", false, "semestre")
    await this.createItem(table.idScoringTable, publicacoes.idScoringNode,  "Artigo Qualis A1",                      "10.00", false, "artigo")
    await this.createItem(table.idScoringTable, projetos.idScoringNode,     "Coordenação de projeto aprovado",       "8.00", false, "projeto")

    // item de pontuação máxima (hasMaxPoints = true) -> sem unidade
    await this.createItem(table.idScoringTable, bancas.idScoringNode,       "Participação em banca de concurso",     "10.00", true, null)

    console.log("Seed concluído para scoring_table id:", table.idScoringTable)
  }

  async clear() {
    await prisma.$transaction([
      prisma.scoringItem.deleteMany(),
      prisma.scoringNode.deleteMany(),
      prisma.scoringTable.deleteMany()
    ])
  }

  async createScoringTable(name: string, startsOn?: string) {
    return prisma.scoringTable.create({
      data: {
        name,
        startsOn: startsOn ? new Date(startsOn) : null
      }
    })
  }

  async createNode(
    scoringTableId: bigint,
    parentId: bigint | null,
    name: string,
    sortOrder: number,
    code?: string | null
  ) {
    return prisma.scoringNode.create({
      data: {
        scoringTableId,
        parentId,
        name,
        code: code ?? null,
        sortOrder,
        active: true
      }
    })
  }

  async createItem(
    scoringTableId: bigint,
    nodeId: bigint,
    description: string,
    points: string,            // usar string p/ evitar arredondamento (Decimal)
    hasMaxPoints: boolean,
    unit: string | null
  ) {
    return prisma.scoringItem.create({
      data: {
        scoringTableId,
        nodeId,
        description,
        points: new Prisma.Decimal(points),
        unit,                   // deve ser NULL quando hasMaxPoints = true
        hasMaxPoints,
        active: true
      }
    })
  }
}

const seeds = new Seeds()
seeds.main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
