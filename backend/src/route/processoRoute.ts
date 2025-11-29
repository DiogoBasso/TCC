// src/route/processoRoute.ts
import { Router } from "express"
import { ProcessoController } from "../controller/processoController"
import { ProcessoService } from "../service/processoService"
import { ProcessRepository } from "../repository/processoRepository"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { UserRepository } from "../repository/userRepository"

export function processoRoute() {
  const router = Router()

  const controller = new ProcessoController(
    new ProcessoService(
      new ProcessRepository(),
      new ScoringTableRepository(),
      new UserRepository()
    )
  )

  // abrir processo
  router.post("/processos/abrir", controller.abrirProcesso)

  // listar processos do usuário (com filtro opcional por status)
  router.get("/processos", controller.listarProcessos)

  // obter processo por id (do usuário)
  router.get("/processos/:id", controller.obterProcesso)

  // editar processo
  router.patch("/processos/:id", controller.editarProcesso)

  // excluir processo (soft delete)
  router.delete("/processos/:id", controller.excluirProcesso)

  // gerar PDF do requerimento
  // se você quiser mudar pra GET, troca aqui e no front:
  // router.get("/processos/requerimento/:id", controller.gerarRequerimento)
  router.post("/processos/requerimento/:id", controller.gerarRequerimento)

  router.post("/processos/:id/enviar", controller.enviarProcesso)

  return router
}
