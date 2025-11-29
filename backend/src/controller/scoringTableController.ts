import { RequestHandler } from "express"
import { ScoringTableService } from "../service/scoringTableService"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { BusinessRuleError } from "../service/processoService"
import { createScoringTableSchema } from "../validator/scoringTableValidation"

export class ScoringTableController {
  constructor(private readonly service: ScoringTableService) {}

  public criarTabelaPontuacao: RequestHandler = async (req, res, _next) => {
    try {
      const { error, value } = createScoringTableSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Dados inválidos para cadastro da tabela de pontuação.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.criarTabelaPontuacao(value)

      return HttpResponse.created(
        res,
        "Tabela de pontuação criada com sucesso",
        result
      )
    } catch (err) {
      console.error("Erro ao criar tabela de pontuação:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          err.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }
}
