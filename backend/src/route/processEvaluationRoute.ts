import { Router } from "express"
import { ProcessoController } from "../controller/processoController"
import { ProcessoService } from "../service/processoService"
import { ProcessRepository } from "../repository/processoRepository"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { UserRepository } from "../repository/userRepository"

import { ProcessEvaluationController } from "../controller/processEvaluationController"
import { ProcessEvaluationService } from "../service/processEvaluationService"

import { authMiddleware } from "../middleware/authMiddleware"
import { validatorMiddleware, ParamType } from "../middleware/validatorMiddleware"
import {
  updateItemScoreSchema,
  finalizeEvaluationSchema
} from "../validator/processEvaluationValidator"

export function processEvaluationRoute() {
  const router = Router()

  const processController = new ProcessoController(
    new ProcessoService(
      new ProcessRepository(),
      new ScoringTableRepository(),
      new UserRepository()
    )
  )

  const evaluationController = new ProcessEvaluationController(
    new ProcessEvaluationService()
  )

  // ... suas rotas já existentes /processes

  // Load process for CPPD evaluation screen
  router.get(
    "/processes/:id/evaluation",
    authMiddleware,
    evaluationController.getProcessForEvaluation
  )

    router.get(
    "/processes/:id/evaluation/evidences/:evidenceFileId/conteudo",
    authMiddleware,
    evaluationController.getEvidenceContentForCppd
  )

  // Update item scores (evaluatorAwardedPoints / evaluatorComment)
  router.patch(
    "/processes/:id/evaluation/items",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, updateItemScoreSchema),
    evaluationController.updateItemScores
  )

  // Finalize evaluation: decision + opinion + evaluators
  router.post(
    "/processes/:id/evaluation/finalize",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, finalizeEvaluationSchema),
    evaluationController.finalizeEvaluation
  )

  return router
}
