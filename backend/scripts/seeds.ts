import { PrismaClient, RoleName, ClassLevel } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // Roles base do sistema
  await prisma.role.createMany({
    data: [
      { name: RoleName.ADMIN },
      { name: RoleName.CPPD_MEMBER },
      { name: RoleName.DOCENTE }
    ],
    skipDuplicates: true
  })

  // Usuário admin
  const adminPasswordHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456",
    10
  )

  await prisma.user.upsert({
    where: { cpf: "81188057006" },
    update: {},
    create: {
      name: "Administrador do Sistema",
      email: "admin@if.edu.br",
      cpf: "81188057006",
      passwordHash: adminPasswordHash,
      active: true,
      roles: {
        create: [{ role: { connect: { name: RoleName.ADMIN } } }]
      }
    }
  })

  // Usuária Marina (DOCENTE + CPPD_MEMBER)
  const marinaPasswordHash = await bcrypt.hash("senhaSegura123", 10)

  await prisma.user.upsert({
    where: { cpf: "51756662070" },
    update: {},
    create: {
      name: "Marina Lopes",
      email: "marina.lopes@if.edu.br",
      cpf: "51756662070",
      passwordHash: marinaPasswordHash,
      active: true,
      roles: {
        create: [
          { role: { connect: { name: RoleName.DOCENTE } } },
          { role: { connect: { name: RoleName.CPPD_MEMBER } } }
        ]
      },
      docente: {
        create: {
          siape: "1234567",
          classLevel: ClassLevel.D1,
          start_interstice: new Date("2023-03-01T00:00:00.000Z"),
          educationLevel: "Mestrado",
          improvement: "Aperfeiçoamento em Metodologias de Ensino",
          specialization: "Ensino de Computação",
          mastersDegree: "Mestrado em Ciência da Computação",
          doctorate: null,
          assignment: "Coordenação de Curso",
          department: "Ciência da Computação",
          division: "Tecnologia da Informação",
          role: "Professor EBTT",
          immediate_supervisor: "Carlos Pereira"
        }
      }
    }
  })

  const table = await upsertScoringTable("Tabela EBTT 2025", new Date("2025-01-01"))

  const ensino = await createNode(table.idScoringTable, null, "Atividades de Ensino", 1, "A")
  const pesquisa = await createNode(table.idScoringTable, null, "Atividades de Pesquisa", 2, "B")
  const extensao = await createNode(table.idScoringTable, null, "Atividades de Extensão", 3, "C")
  const administracao = await createNode(table.idScoringTable, null, "Atividades Administrativas", 4, "D")

  const aulas = await createNode(table.idScoringTable, ensino.idScoringNode, "Ministração de aulas", 1, "A1")
  const orientacoes = await createNode(table.idScoringTable, ensino.idScoringNode, "Orientações", 2, "A2")
  const estagios = await createNode(table.idScoringTable, ensino.idScoringNode, "Supervisão de estágio", 3, "A3")

  await createItem(table.idScoringTable, aulas.idScoringNode, "Hora-aula ministrada", "1.00", "hora", false)
  await createItem(table.idScoringTable, aulas.idScoringNode, "Disciplina semestral concluída", "20.00", "disciplina", true)
  await createItem(table.idScoringTable, orientacoes.idScoringNode, "Orientação de TCC concluída", "8.00", "orientação", true)
  await createItem(table.idScoringTable, orientacoes.idScoringNode, "Co-orientação de TCC concluída", "4.00", "coorientação", true)
  await createItem(table.idScoringTable, estagios.idScoringNode, "Supervisão de estágio por aluno/semestre", "6.00", "aluno", true)

  const publicacoes = await createNode(table.idScoringTable, pesquisa.idScoringNode, "Publicações", 1, "B1")
  const projetosPesq = await createNode(table.idScoringTable, pesquisa.idScoringNode, "Projetos de pesquisa", 2, "B2")

  await createItem(table.idScoringTable, publicacoes.idScoringNode, "Artigo em periódico Qualis A/B", "30.00", "artigo", true)
  await createItem(table.idScoringTable, publicacoes.idScoringNode, "Artigo completo em conferência", "15.00", "artigo", true)
  await createItem(table.idScoringTable, projetosPesq.idScoringNode, "Coordenação de projeto de pesquisa", "25.00", "projeto", true)
  await createItem(table.idScoringTable, projetosPesq.idScoringNode, "Participação em projeto de pesquisa", "10.00", "projeto", true)

  const projetosExt = await createNode(table.idScoringTable, extensao.idScoringNode, "Projetos de extensão", 1, "C1")
  const acoesExt = await createNode(table.idScoringTable, extensao.idScoringNode, "Ações/eventos de extensão", 2, "C2")

  await createItem(table.idScoringTable, projetosExt.idScoringNode, "Coordenação de projeto de extensão", "20.00", "projeto", true)
  await createItem(table.idScoringTable, projetosExt.idScoringNode, "Participação em projeto de extensão", "8.00", "projeto", true)
  await createItem(table.idScoringTable, acoesExt.idScoringNode, "Organização de evento de extensão", "12.00", "evento", true)
  await createItem(table.idScoringTable, acoesExt.idScoringNode, "Ministração de ação/oficina", "6.00", "ação", true)

  const coordenacao = await createNode(table.idScoringTable, administracao.idScoringNode, "Coordenação/Gestão", 1, "D1")
  const comissoes = await createNode(table.idScoringTable, administracao.idScoringNode, "Comissões e colegiados", 2, "D2")

  await createItem(table.idScoringTable, coordenacao.idScoringNode, "Coordenação de curso por semestre", "18.00", "semestre", true)
  await createItem(table.idScoringTable, coordenacao.idScoringNode, "Chefia/Coordenação de setor", "22.00", "semestre", true)
  await createItem(table.idScoringTable, comissoes.idScoringNode, "Participação em comissão permanente", "6.00", "semestre", true)
  await createItem(table.idScoringTable, comissoes.idScoringNode, "Participação em comissão temporária", "4.00", "atividade", true)
}

async function upsertScoringTable(name: string, startsOn?: Date) {
  const existing = await prisma.scoringTable.findFirst({
    where: { name, deletedDate: null }
  })
  if (existing) return existing
  return prisma.scoringTable.create({
    data: { name, startsOn: startsOn ?? null }
  })
}

async function createNode(
  scoringTableId: number,
  parentId: number | null,
  name: string,
  sortOrder: number,
  code?: string | null
) {
  const existing = await prisma.scoringNode.findFirst({
    where: { scoringTableId, parentId: parentId ?? undefined, name }
  })
  if (existing) return existing
  return prisma.scoringNode.create({
    data: {
      scoringTableId,
      parentId,
      name,
      sortOrder,
      code: code ?? null,
      active: true
    }
  })
}

async function createItem(
  scoringTableId: number,
  nodeId: number,
  description: string,
  points: string,
  unit?: string | null,
  hasMaxPoints?: boolean
) {
  const existing = await prisma.scoringItem.findFirst({
    where: { scoringTableId, nodeId, description, deletedDate: null }
  })
  if (existing) return existing
  return prisma.scoringItem.create({
    data: {
      scoringTableId,
      nodeId,
      description,
      points: points as any,
      unit: unit ?? null,
      hasMaxPoints: Boolean(hasMaxPoints),
      active: true
    }
  })
}

main()
  .catch(e => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
