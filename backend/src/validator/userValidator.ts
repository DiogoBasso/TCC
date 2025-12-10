import { RoleName, ClassLevel } from "@prisma/client"
import Joi from "joi"
import { cpf as cpfValidator } from "cpf-cnpj-validator"

function onlyDigits(input: string): string {
  let out = ""
  for (const ch of input) {
    if (ch >= "0" && ch <= "9") out += ch
  }
  return out
}

function validatePhone(v: string, helpers: Joi.CustomHelpers<string>) {
  if (typeof v !== "string") return helpers.error("any.invalid")
  const digits = onlyDigits(v)
  if (digits.length < 10 || digits.length > 11) return helpers.error("any.invalid")
  return v
}

const docenteProfileSchema = Joi.object({
  siape: Joi.string().trim().required(),
  classLevel: Joi.string()
    .valid(...Object.values(ClassLevel))
    .required(),
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
      const digits = onlyDigits(value)
      if (!cpfValidator.isValid(digits)) return helpers.error("any.invalid")
      return digits        // ✅ já normaliza para só dígitos
    })
    .messages({ "any.invalid": "CPF inválido" })
    .required(),
  phone: Joi.string()
    .trim()
    .custom(validatePhone)
    .messages({ "any.invalid": "Telefone inválido (use 10 ou 11 dígitos)" })
    .required(),
  city: Joi.string().max(100).allow(null, "").optional(),            // ✅ novo
  uf: Joi.string().length(2).uppercase().allow(null, "").optional(), // ✅ novo
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
      const digits = onlyDigits(value)
      if (!cpfValidator.isValid(digits)) return helpers.error("any.invalid")
      return digits          // ✅ login também já usa só dígitos
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

export const logoutSchema = Joi.object({
  refreshToken: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)
    .required()
})

const updateDocenteSchema = Joi.object({
  siape: Joi.string().trim().optional(),
  classLevel: Joi.string()
    .valid(...Object.values(ClassLevel))
    .optional(),
  startInterstice: Joi.date().optional(),
  educationLevel: Joi.string().trim().optional(),
  improvement: Joi.string().trim().allow(null).optional(),
  specialization: Joi.string().trim().allow(null).optional(),
  mastersDegree: Joi.string().trim().allow(null).optional(),
  doctorate: Joi.string().trim().allow(null).optional(),
  assignment: Joi.string().trim().allow(null).optional(),
  department: Joi.string().trim().allow(null).optional(),
  division: Joi.string().trim().allow(null).optional(),
  role: Joi.string().trim().allow(null).optional(),
  immediateSupervisor: Joi.string().trim().allow(null).optional()
})

export const updateUserSchema = Joi.object({
  name: Joi.string().trim().optional(),
  email: Joi.string().email().optional(),
  cpf: Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (value === undefined) return value
      const digits = onlyDigits(value)
      return !cpfValidator.isValid(digits) ? helpers.error("any.invalid") : digits // ✅ normaliza se vier
    })
    .messages({ "any.invalid": "CPF inválido" })
    .optional(),
  phone: Joi.string()
    .trim()
    .custom((v, h) => (v === undefined ? v : validatePhone(v, h)))
    .messages({ "any.invalid": "Telefone inválido (use 10 ou 11 dígitos)" })
    .optional(),
  city: Joi.string().max(100).allow(null, "").optional(),          // ✅ novo
  uf: Joi.string().length(2).uppercase().allow(null, "").optional(), // ✅ agora optional
  active: Joi.boolean().optional(),
  roles: Joi.array()
    .items(Joi.string().valid(RoleName.ADMIN, RoleName.CPPD_MEMBER, RoleName.DOCENTE))
    .optional(),
  docenteProfile: updateDocenteSchema.optional()
})

export const userIdParamSchema = Joi.object({
  userId: Joi.number().integer().positive().required()
})

export const userIdQuerySchema = Joi.object({
  id: Joi.number().integer().positive().required()
})

export const publicDocenteRegisterSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().email().required(),
  cpf: Joi.string()
    .trim()
    .custom((v, h) => {
      const digits = onlyDigits(v)
      return !cpfValidator.isValid(digits) ? h.error("any.invalid") : digits   // ✅ normaliza
    })
    .messages({ "any.invalid": "CPF inválido" })
    .required(),
  phone: Joi.string()
    .trim()
    .custom(validatePhone)
    .messages({ "any.invalid": "Telefone inválido (use 10 ou 11 dígitos)" })
    .required(),
  city: Joi.string().max(100).allow(null, ""),
  uf: Joi.string().length(2).uppercase().allow(null, ""),
  password: Joi.string().min(8).required(),
  docenteProfile: docenteProfileSchema.required(),
  roles: Joi.forbidden()
})
