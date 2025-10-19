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

export interface UpdateUserWithRolesAndDocenteInput {
  name?: string
  email?: string
  cpf?: string
  active?: boolean
  roles?: RoleName[]
  docenteProfile?: UpdateDocenteProfileInput
}


export interface UpdateDocenteProfileInput {
  siape?: string
  class?: string
  level?: string
  startInterstice?: Date
  educationLevel?: string
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

  async findManyActive() {
    return prisma.user.findMany({
      where: { deletedDate: null, active: true },
      include: {
        roles: { include: { role: true } },
        docente: true
      },
      orderBy: { createdAt: "desc" }
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

  async updateWithRolesAndDocente(userId: number, input: UpdateUserWithRolesAndDocenteInput) {
    const data: any = {}

    if (input.name !== undefined) data.name = input.name
    if (input.email !== undefined) data.email = input.email
    if (input.cpf !== undefined) data.cpf = input.cpf
    if (input.active !== undefined) data.active = input.active

    if (input.roles) {
      data.roles = {
        deleteMany: {},
        create: input.roles.map((name) => ({
          role: { connect: { name } }
        }))
      }
    }

    if (input.docenteProfile) {
      const p = input.docenteProfile
      const docenteUpdate: any = {}
      if (p.siape !== undefined) docenteUpdate.siape = p.siape
      if (p.class !== undefined) docenteUpdate.class = p.class
      if (p.level !== undefined) docenteUpdate.level = p.level
      if (p.startInterstice !== undefined) docenteUpdate.start_interstice = p.startInterstice
      if (p.educationLevel !== undefined) docenteUpdate.educationLevel = p.educationLevel
      if (p.improvement !== undefined) docenteUpdate.improvement = p.improvement
      if (p.specialization !== undefined) docenteUpdate.specialization = p.specialization
      if (p.mastersDegree !== undefined) docenteUpdate.mastersDegree = p.mastersDegree
      if (p.doctorate !== undefined) docenteUpdate.doctorate = p.doctorate
      if (p.assignment !== undefined) docenteUpdate.assignment = p.assignment
      if (p.department !== undefined) docenteUpdate.department = p.department
      if (p.division !== undefined) docenteUpdate.division = p.division
      if (p.role !== undefined) docenteUpdate.role = p.role
      if (p.immediateSupervisor !== undefined) docenteUpdate.immediate_supervisor = p.immediateSupervisor

      data.docente = {
        upsert: {
          update: docenteUpdate,
          create: {
            siape: p.siape!,
            class: p.class!,
            level: p.level!,
            start_interstice: p.startInterstice!,
            educationLevel: p.educationLevel!,
            improvement: p.improvement ?? null,
            specialization: p.specialization ?? null,
            mastersDegree: p.mastersDegree ?? null,
            doctorate: p.doctorate ?? null,
            assignment: p.assignment ?? null,
            department: p.department ?? null,
            division: p.division ?? null,
            role: p.role ?? null,
            immediate_supervisor: p.immediateSupervisor ?? null
          }
        }
      }
    }

    return prisma.user.update({
      where: { idUser: userId },
      data,
      include: {
        roles: { include: { role: true } },
        docente: true
      }
    })
  }

  async deleteUserById(userId: number) {
    return prisma.user.update({
      where: { idUser: userId },
      data: { active: false, deletedDate: new Date() },
      include: {
        roles: { include: { role: true } },
        docente: true
      }
    })
  }
  
}
