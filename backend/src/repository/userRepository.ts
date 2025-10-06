import { RoleName } from "@prisma/client"
import { prisma } from "../infra/prismaClient"

export interface CreateWithRolesAndDocenteInput {
  name: string
  email: string
  cpf: string
  passwordHash: string
  roles: RoleName[]
  docenteProfile?: {
    siape: string
    class: string
    level: string
    startInterstice: Date
    educationLevel: string
    improvement?: string | null
    specialization?: string | null
    mastersDegree?: string | null
    doctorate?: string | null
    assignment?: string | null
    department?: string | null
    division?: string | null
    role?: string | null
    immediateSupervisor?: string | null
  }
}

export class UserRepository {
  async findByCpf(cpf: string) {
    return prisma.user.findUnique({
      where: { cpf },
      include: {
        roles: { include: { role: true } },
        docente: true
      }
    })
  }

  async findById(idUser: number) {
    if (!Number.isInteger(idUser)) {
      throw new Error("idUser inválido em findById")
    }

    return prisma.user.findFirst({
      where: { idUser, deletedDate: null }, // ok em findFirst
      include: {
        roles: { include: { role: true } },
        docente: true
      }
    })
  }

  async createWithRolesAndDocente(input: CreateWithRolesAndDocenteInput) {
    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        cpf: input.cpf,
        passwordHash: input.passwordHash,
        roles: {
          create: input.roles.map(name => ({
            role: { connect: { name } }
          }))
        },
        docente: input.docenteProfile
          ? {
              create: {
                siape: input.docenteProfile.siape,
                class: input.docenteProfile.class,
                level: input.docenteProfile.level,
                start_interstice: input.docenteProfile.startInterstice,
                educationLevel: input.docenteProfile.educationLevel,
                improvement: input.docenteProfile.improvement ?? null,
                specialization: input.docenteProfile.specialization ?? null,
                mastersDegree: input.docenteProfile.mastersDegree ?? null,
                doctorate: input.docenteProfile.doctorate ?? null,
                assignment: input.docenteProfile.assignment ?? null,
                department: input.docenteProfile.department ?? null,
                division: input.docenteProfile.division ?? null,
                role: input.docenteProfile.role ?? null,
                immediate_supervisor: input.docenteProfile.immediateSupervisor ?? null
              }
            }
          : undefined
      },
      include: {
        roles: { include: { role: true } },
        docente: true
      }
    })

    return created
  }
  
}
