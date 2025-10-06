import { RoleName } from "@prisma/client"

export interface CreateUserDto {
  name: string
  email: string
  cpf: string
  password: string
  roles: RoleName[] 
  docenteProfile?: CreateDocenteProfileDto //obrigatório se roles incluir "DOCENTE"
}

export interface CreateDocenteProfileDto {
  siape: string                   
  class: string                   
  level: string                   
  startInterstice: Date         
  educationLevel: string
  improvement?: string
  specialization?: string
  mastersDegree?: string
  doctorate?: string
  assignment?: string
  department?: string
  division?: string
  role?: string
  immediateSupervisor?: string
}

export interface UpdateUserDto {
  userId: number
  name?: string
  email?: string
  cpf?: string
  active?: boolean
  roles?: RoleName[]
  docenteProfile?: UpdateDocenteProfileDto //atualizar (ou criar se não existir)
}

export interface UpdateDocenteProfileDto {
  siape?: string
  class?: string
  level?: string
  startInterstice?: Date
  educationLevel?: string
  improvement?: string
  specialization?: string
  mastersDegree?: string
  doctorate?: string
  assignment?: string
  department?: string
  division?: string
  role?: string
  immediateSupervisor?: string
}

export interface DeleteUserDto {
  userId: number
}

export interface LoginDto {
  cpf: string
  password: string
}

export interface RefreshTokenDto {
  refreshToken: string
}


export interface SetUserRolesDto {
  userId: number
  roles: RoleName[]
}


export interface UserResponseDto {
  idUser: number
  name: string
  email: string
  cpf: string
  active: boolean
  createdAt: Date
  deletedDate?: Date | null
  roles: RoleName[]
  docenteProfile?: DocenteProfileResponseDto | null
}

export interface DocenteProfileResponseDto {
  idDocente: number
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
