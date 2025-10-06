import { UserService } from "../service/userService"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { createUserSchema } from "../validator/userValidator"
import { UserExists } from "../exception/user-exists"
import { DocenteProfileRequired } from "../exception/docente-profile-required"
import { LoginResponseWithRoles } from "../type/response/userResponse"
import { InvalidCredentials } from "../exception/invalid-credentials"
import { InvalidRefreshToken } from "../exception/invalid-refresh-token"
import { RoleName } from "@prisma/client"

export class UserController {
  constructor(private readonly userService: UserService) {}

  async login(req: any, res: any): Promise<void> {
    try {
      const dto = { cpf: req.body.cpf, password: req.body.password }
      const response = await this.userService.login(dto)
      return HttpResponse.ok<LoginResponseWithRoles>(res, "Login successful", response)
    } catch (error: any) {
      console.log("Request failed:", error?.message)
      if (error instanceof InvalidCredentials) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_CREDENTIALS, error.message, null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async refreshToken(req: any, res: any): Promise<void> {
    try {
      const dto = { refreshToken: req.body.refreshToken }
      const response = await this.userService.refreshToken(dto)
      return HttpResponse.ok<LoginResponseWithRoles>(res, "Refresh token successful", response)
    } catch (error: any) {
      console.log("Request failed:", error?.message)
      if (error instanceof InvalidRefreshToken) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_REFRESH_TOKEN, error.message, null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async selectRole(req: any, res: any): Promise<void> {
    console.log("SELECT-ROLE body:", req.body)
    try {
      const refreshToken: string | undefined = req.body?.refreshToken
      const role: RoleName | undefined = req.body?.role

      if (!refreshToken || !role) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "refreshToken e role são obrigatórios", null)
      }

      const response = await this.userService.selectRole(refreshToken, role)
      return HttpResponse.ok<LoginResponseWithRoles>(res, "Role selected", response)
    } catch (error: any) {
      console.log("Request failed:", error?.message)
      if (error instanceof InvalidRefreshToken) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_REFRESH_TOKEN, error.message, null)
      }
      return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid role selection", null)
    }
  }

  async createUser(req: any, res: any): Promise<void> {
    try {
      const { error, value } = createUserSchema.validate(req.body, { abortEarly: false })
      if (error) {
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Validation failed",
          error.details.map(d => d.message)
        )
      }

      const dto = {
        name: value.name,
        email: value.email,
        cpf: value.cpf,
        password: value.password,
        roles: value.roles,
        docenteProfile: value.docenteProfile
          ? {
              siape: value.docenteProfile.siape,
              class: value.docenteProfile.class,
              level: value.docenteProfile.level,
              startInterstice: value.docenteProfile.startInterstice,
              educationLevel: value.docenteProfile.educationLevel,
              improvement: value.docenteProfile.improvement,
              specialization: value.docenteProfile.specialization,
              mastersDegree: value.docenteProfile.mastersDegree,
              doctorate: value.docenteProfile.doctorate,
              assignment: value.docenteProfile.assignment,
              department: value.docenteProfile.department,
              division: value.docenteProfile.division,
              role: value.docenteProfile.role,
              immediateSupervisor: value.docenteProfile.immediateSupervisor
            }
          : undefined
      }

      const user = await this.userService.createUser(dto)

      return HttpResponse.created(res, "User created", {
        idUser: user.idUser,
        name: user.name,
        cpf: user.cpf,
        email: user.email,
        active: user.active,
        createdAt: user.createdAt,
        deletedDate: user.deletedDate ?? null,
        roles: user.roles,
        docenteProfile: user.docenteProfile
          ? {
              idDocente: user.docenteProfile.idDocente,
              siape: user.docenteProfile.siape,
              class: user.docenteProfile.class,
              level: user.docenteProfile.level,
              startInterstice: user.docenteProfile.startInterstice,
              educationLevel: user.docenteProfile.educationLevel,
              improvement: user.docenteProfile.improvement ?? null,
              specialization: user.docenteProfile.specialization ?? null,
              mastersDegree: user.docenteProfile.mastersDegree ?? null,
              doctorate: user.docenteProfile.doctorate ?? null,
              assignment: user.docenteProfile.assignment ?? null,
              department: user.docenteProfile.department ?? null,
              division: user.docenteProfile.division ?? null,
              role: user.docenteProfile.role ?? null,
              immediateSupervisor: user.docenteProfile.immediateSupervisor ?? null
            }
          : null
      })
    } catch (error: any) {
      console.log("Request failed:", error?.message)

      if (error instanceof UserExists) {
        return HttpResponse.badRequest(res, StatusCodeDescription.USER_EXISTS, error.message, null)
      }

      if (typeof DocenteProfileRequired !== "undefined" && error instanceof DocenteProfileRequired) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      }

      if (error?.code === "P2002") {
        const target = Array.isArray(error?.meta?.target)
          ? error.meta.target.join(", ")
          : "unique field"
        return HttpResponse.badRequest(res, StatusCodeDescription.USER_EXISTS, `Violação de unicidade em: ${target}`, null)
      }

      return HttpResponse.internalError(res)
    }
  }
}
