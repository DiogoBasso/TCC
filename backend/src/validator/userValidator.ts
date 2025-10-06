import { RoleName } from "@prisma/client"
import Joi from "joi"
import { cpf as cpfValidator } from "cpf-cnpj-validator"

const docenteProfileSchema = Joi.object({
  siape: Joi.string().trim().required(),
  class: Joi.string().trim().required(),
  level: Joi.string().trim().required(),
  startInterstice: Joi.date().required(),
  educationLevel: Joi.string().trim().required(),
  improvement: Joi.string().trim().optional().allow(null),
  specialization: Joi.string().trim().optional().allow(null),
  mastersDegree: Joi.string().trim().optional().allow(null),
  doctorate: Joi.string().trim().optional().allow(null),
  assignment: Joi.string().trim().optional().allow(null),
  department: Joi.string().trim().optional().allow(null),
  division: Joi.string().trim().optional().allow(null),
  role: Joi.string().trim().optional().allow(null),
  immediateSupervisor: Joi.string().trim().optional().allow(null)
})

export const createUserSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().email().required(),
  cpf: Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (!cpfValidator.isValid(value)) return helpers.error("any.invalid")
      return value
    })
    .messages({ "any.invalid": "CPF inválido" })
    .required(),
  password: Joi.string().min(8).required(),
  roles: Joi.array()
    .items(Joi.string().valid(RoleName.ADMIN, RoleName.CPPD_MEMBER, RoleName.DOCENTE))
    .min(1)
    .required(),
  docenteProfile: Joi.when("roles", {
    is: Joi.array().items(Joi.valid(RoleName.DOCENTE)).has(RoleName.DOCENTE),
    then: docenteProfileSchema.required(),
    otherwise: docenteProfileSchema.optional()
  })
})

export const loginSchema = Joi.object({
  cpf: Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (!cpfValidator.isValid(value)) return helpers.error("any.invalid")
      return value
    })
    .messages({ "any.invalid": "CPF inválido" })
    .required(),
  password: Joi.string().required()
})

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().required()
})

export const selectRoleSchema = Joi.object({
  refreshToken: Joi.string().trim().required(),
  role: Joi.string().valid(RoleName.DOCENTE, RoleName.CPPD_MEMBER).required()
})