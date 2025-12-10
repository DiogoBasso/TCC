import Joi from "joi"

export const updateItemScoreSchema = Joi.object({
  scores: Joi.array()
    .items(
      Joi.object({
        itemId: Joi.number().integer().positive().required(),
        evaluatorAwardedPoints: Joi.string()
          .pattern(/^\d+([.,]\d+)?$/)
          .allow(null, ""),
        evaluatorComment: Joi.string().max(500).allow(null, "")
      })
    )
    .min(1)
    .required()
})

export const finalizeEvaluationSchema = Joi.object({
  decision: Joi.string()
    .valid("APPROVED", "REJECTED", "RETURNED")
    .required(),

  evaluatorUserIds: Joi.array()
    .items(Joi.number().integer().positive())
    .optional(),

  overrideOpinion: Joi.string().allow(null, "").optional()
})
