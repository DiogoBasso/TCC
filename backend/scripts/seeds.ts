// prisma/seed.ts (ou src/seed/seed.ts, como preferir)
import { PrismaClient, RoleName } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // 1) Roles
  await prisma.role.createMany({
    data: [
      { name: RoleName.ADMIN },
      { name: RoleName.CPPD_MEMBER },
      { name: RoleName.DOCENTE }
    ],
    skipDuplicates: true
  })
  console.log("✅ Roles seeded")

  // 2) Admin (apenas via seed)
  const adminPasswordHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456",
    10
  )

  await prisma.user.upsert({
    where: { cpf: "00000000000" }, // <-- troque para um CPF válido do seu ambiente
    update: {},
    create: {
      name: "Administrador do Sistema",
      email: "admin@if.edu.br",
      cpf: "00000000000",
      passwordHash: adminPasswordHash,
      active: true,
      roles: {
        create: [
          { role: { connect: { name: RoleName.ADMIN } } }
        ]
      }
    }
  })
  console.log("✅ Admin seeded")

  // 3) Usuário com DOCENTE + CPPD_MEMBER + DocenteProfile
  const marinaPasswordHash = await bcrypt.hash("senhaSegura123", 10)

  await prisma.user.upsert({
    where: { cpf: "12345678909" }, // <-- troque se precisar
    update: {},
    create: {
      name: "Marina Lopes",
      email: "marina.lopes@if.edu.br",
      cpf: "12345678909",
      passwordHash: marinaPasswordHash,
      active: true,
      // vincula DOCENTE + CPPD_MEMBER
      roles: {
        create: [
          { role: { connect: { name: RoleName.DOCENTE } } },
          { role: { connect: { name: RoleName.CPPD_MEMBER } } }
        ]
      },
      // cria o perfil docente
      docente: {
        create: {
          siape: "1234567",
          class: "D",
          level: "III",
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
  console.log("✅ User DOCENTE+CPPD_MEMBER seeded")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
