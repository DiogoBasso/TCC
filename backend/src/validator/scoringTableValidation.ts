import Joi from "joi"
import { CreateScoringTableDto } from "../type/dto/scoringTableDto"

const itemSchema = Joi.object({
  description: Joi.string().max(255).required(),
  unit: Joi.string().max(30).allow(null, ""),
  points: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  hasMaxPoints: Joi.boolean().default(false),
  maxPoints: Joi.alternatives()
    .try(Joi.number(), Joi.string())
    .allow(null)
    .when("hasMaxPoints", {
      is: true,
      then: Joi.required()
    }),
  formulaKey: Joi.string()
    .max(30)
    .pattern(/^[A-Z][A-Z0-9_]*$/)
    .allow(null, "")
})

const nodeSchema = Joi.object({
  name: Joi.string().max(150).required(),
  code: Joi.string().max(50).allow(null, ""),
  sortOrder: Joi.number().integer().min(0).default(0),
  parentCode: Joi.string().max(50).allow(null, ""),
  hasFormula: Joi.boolean().default(false),
  formulaExpression: Joi.string()
    .max(255)
    .allow(null, "")
    .when("hasFormula", {
      is: true,
      then: Joi.required()
    }),
  items: Joi.array().items(itemSchema).min(1).required()
})

export const createScoringTableSchema = Joi.object<CreateScoringTableDto>({
  name: Joi.string().max(120).required(),
  startsOn: Joi.string().isoDate().allow(null, ""),
  endsOn: Joi.string().isoDate().allow(null, ""),
  nodes: Joi.array().items(nodeSchema).min(1).required()
})
