import { Router } from "express"
import { ScoringTableController } from "../controller/scoringTableController"
import { ScoringTableService } from "../service/scoringTableService"
import { ScoringTableRepository } from "../repository/scoringTableRepository"

export function scoringTableRoute() {
  const router = Router()

  const controller = new ScoringTableController(
    new ScoringTableService(new ScoringTableRepository())
  )

  router.post("/admin/tabelas-pontuacao", controller.criarTabelaPontuacao)

  return router
}
