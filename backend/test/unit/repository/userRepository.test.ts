import { describe, expect, jest, beforeEach, test } from "@jest/globals"
import { RoleName } from "@prisma/client"
import { prisma } from "../../../src/infra/prismaClient"
import { UserRepository } from "../../../src/repository/userRepository"

describe("UserRepository", () => {
  const repository = new UserRepository()
  const now = new Date()

  const dbUser = {
    idUser: 10,
    name: "Fulano",
    email: "fulano@if.edu.br",
    cpf: "11122233344",
    passwordHash: "hashed",
    active: true,
    createdAt: now,
    deletedDate: null,
    roles: [{ role: { name: RoleName.ADMIN } }, { role: { name: RoleName.DOCENTE } }],
    docente: {
      idDocente: 7,
      siape: "1234567",
      class: "D I",
      level: "1",
      start_interstice: new Date("2024-01-01T00:00:00Z"),
      educationLevel: "Mestrado",
      improvement: null,
      specialization: null,
      mastersDegree: "Mestrado X",
      doctorate: null,
      assignment: "Ensino",
      department: "Computação",
      division: null,
      role: null,
      immediate_supervisor: null
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("findByCpf", () => {
    test("retorna usuário com include de roles e docente", async () => {
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(dbUser as any)

      const result = await repository.findByCpf(dbUser.cpf)

      expect(result).toEqual(dbUser)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { cpf: dbUser.cpf },
        include: {
          roles: { include: { role: true } },
          docente: true
        }
      })
    })
  })

  describe("findById", () => {
    test("dispara erro se idUser não é inteiro", async () => {
      await expect(repository.findById(Number.NaN as any)).rejects.toThrow("idUser inválido em findById")
    })

    test("retorna usuário ativo e não deletado", async () => {
      jest.spyOn(prisma.user, "findFirst").mockResolvedValue(dbUser as any)

      const result = await repository.findById(dbUser.idUser)

      expect(result).toEqual(dbUser)
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { idUser: dbUser.idUser, deletedDate: null },
        include: {
          roles: { include: { role: true } },
          docente: true
        }
      })
    })
  })

  describe("findManyActive", () => {
    test("retorna apenas ativos, ordenados por createdAt desc", async () => {
      jest.spyOn(prisma.user, "findMany").mockResolvedValue([dbUser] as any)

      const result = await repository.findManyActive()

      expect(result).toEqual([dbUser])
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deletedDate: null, active: true },
        include: {
          roles: { include: { role: true } },
          docente: true
        },
        orderBy: { createdAt: "desc" }
      })
    })
  })

  describe("createWithRolesAndDocente", () => {
    test("cria usuário com roles e opcionalmente docente", async () => {
      jest.spyOn(prisma.user, "create").mockResolvedValue(dbUser as any)

      const input = {
        name: dbUser.name,
        email: dbUser.email,
        cpf: dbUser.cpf,
        passwordHash: dbUser.passwordHash,
        roles: [RoleName.ADMIN, RoleName.DOCENTE],
        docenteProfile: {
          siape: "1234567",
          class: "D I",
          level: "1",
          startInterstice: new Date("2024-01-01T00:00:00Z"),
          educationLevel: "Mestrado",
          improvement: null,
          specialization: null,
          mastersDegree: "Mestrado X",
          doctorate: null,
          assignment: "Ensino",
          department: "Computação",
          division: null,
          role: null,
          immediateSupervisor: null
        }
      }

      const created = await repository.createWithRolesAndDocente(input)

      expect(created).toEqual(dbUser)
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          email: input.email,
          cpf: input.cpf,
          passwordHash: input.passwordHash,
          roles: {
            create: input.roles.map(r => ({ role: { connect: { name: r } } }))
          },
          docente: {
            create: {
              siape: input.docenteProfile!.siape,
              class: input.docenteProfile!.class,
              level: input.docenteProfile!.level,
              start_interstice: input.docenteProfile!.startInterstice,
              educationLevel: input.docenteProfile!.educationLevel,
              improvement: null,
              specialization: null,
              mastersDegree: "Mestrado X",
              doctorate: null,
              assignment: "Ensino",
              department: "Computação",
              division: null,
              role: null,
              immediate_supervisor: null
            }
          }
        },
        include: {
          roles: { include: { role: true } },
          docente: true
        }
      })
    })

    test("cria usuário sem docente quando não informado", async () => {
      jest.spyOn(prisma.user, "create").mockResolvedValue({ ...dbUser, docente: null } as any)

      const input = {
        name: dbUser.name,
        email: dbUser.email,
        cpf: dbUser.cpf,
        passwordHash: dbUser.passwordHash,
        roles: [RoleName.ADMIN]
      }

      await repository.createWithRolesAndDocente(input as any)

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          email: input.email,
          cpf: input.cpf,
          passwordHash: input.passwordHash,
          roles: {
            create: input.roles.map(r => ({ role: { connect: { name: r } } }))
          },
          docente: undefined
        },
        include: {
          roles: { include: { role: true } },
          docente: true
        }
      })
    })
  })

  describe("updateWithRolesAndDocente", () => {
    test("atualiza campos simples e reseta roles com create, e upsert de docente", async () => {
      jest.spyOn(prisma.user, "update").mockResolvedValue(dbUser as any)

      const input = {
        name: "Novo Nome",
        email: "novo@if.edu.br",
        cpf: "99988877766",
        active: false,
        roles: [RoleName.DOCENTE],
        docenteProfile: {
          siape: "7654321",
          class: "D II",
          level: "2",
          startInterstice: new Date("2024-02-01T00:00:00Z"),
          educationLevel: "Doutorado",
          improvement: "MBA",
          specialization: null,
          mastersDegree: null,
          doctorate: "PhD",
          assignment: "Pesquisa",
          department: "Computação",
          division: "INF",
          role: "Coordenador",
          immediateSupervisor: "Diretor"
        }
      }

      const result = await repository.updateWithRolesAndDocente(dbUser.idUser, input as any)

      expect(result).toEqual(dbUser)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { idUser: dbUser.idUser },
        data: {
          name: input.name,
          email: input.email,
          cpf: input.cpf,
          active: input.active,
          roles: {
            deleteMany: {},
            create: input.roles.map(r => ({ role: { connect: { name: r } } }))
          },
          docente: {
            upsert: {
              update: {
                siape: input.docenteProfile!.siape,
                class: input.docenteProfile!.class,
                level: input.docenteProfile!.level,
                start_interstice: input.docenteProfile!.startInterstice,
                educationLevel: input.docenteProfile!.educationLevel,
                improvement: input.docenteProfile!.improvement,
                specialization: input.docenteProfile!.specialization,
                mastersDegree: input.docenteProfile!.mastersDegree,
                doctorate: input.docenteProfile!.doctorate,
                assignment: input.docenteProfile!.assignment,
                department: input.docenteProfile!.department,
                division: input.docenteProfile!.division,
                role: input.docenteProfile!.role,
                immediate_supervisor: input.docenteProfile!.immediateSupervisor
              },
              create: {
                siape: input.docenteProfile!.siape,
                class: input.docenteProfile!.class,
                level: input.docenteProfile!.level,
                start_interstice: input.docenteProfile!.startInterstice,
                educationLevel: input.docenteProfile!.educationLevel,
                improvement: input.docenteProfile!.improvement,
                specialization: input.docenteProfile!.specialization,
                mastersDegree: input.docenteProfile!.mastersDegree,
                doctorate: input.docenteProfile!.doctorate,
                assignment: input.docenteProfile!.assignment,
                department: input.docenteProfile!.department,
                division: input.docenteProfile!.division,
                role: input.docenteProfile!.role,
                immediate_supervisor: input.docenteProfile!.immediateSupervisor
              }
            }
          }
        },
        include: {
          roles: { include: { role: true } },
          docente: true
        }
      })
    })

    test("não envia blocos não definidos", async () => {
      jest.spyOn(prisma.user, "update").mockResolvedValue(dbUser as any)

      await repository.updateWithRolesAndDocente(dbUser.idUser, {
        name: "Apenas Nome"
      })

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { idUser: dbUser.idUser },
        data: { name: "Apenas Nome" },
        include: {
          roles: { include: { role: true } },
          docente: true
        }
      })
    })
  })

  describe("deleteUserById", () => {
    test("inativa e seta deletedDate", async () => {
      const deleted = { ...dbUser, active: false, deletedDate: now }
      jest.spyOn(prisma.user, "update").mockResolvedValue(deleted as any)

      const result = await repository.deleteUserById(dbUser.idUser)

      expect(result).toEqual(deleted)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { idUser: dbUser.idUser },
        data: { active: false, deletedDate: expect.any(Date) },
        include: {
          roles: { include: { role: true } },
          docente: true
        }
      })
    })
  })
})
