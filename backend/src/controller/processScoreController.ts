// src/controller/processScoreController.ts
import { RequestHandler } from "express"
import jwt from "jsonwebtoken"
import fs from "fs"
import { ProcessScoreService } from "../service/processScoreService"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { BusinessRuleError, NotFoundError } from "../service/processoService"
import { UpdateItemScoreDto } from "../type/dto/processScoreDto"
import { upload } from "../infra/upload"

export class ProcessScoreController {
  constructor(private readonly service: ProcessScoreService) {}

  private extrairUserId(req: any): number | null {
    const auth = req.header("Authorization") || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

    if (!token) {
      return null
    }

    try {
      const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
      const userId = Number(payload?.sub)
      if (!userId || Number.isNaN(userId)) {
        return null
      }
      return userId
    } catch {
      return null
    }
  }

  public listarEstruturaPontuacao: RequestHandler = async (req, res, _next) => {
    try {
      const userId = this.extrairUserId(req)
      if (!userId) {
        HttpResponse.unauthorized(res)
        return
      }

      const processId = Number(req.params.id)
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null
        )
        return
      }

      const result = await this.service.listarEstruturaPontuacao(processId, userId)

      return HttpResponse.ok(
        res,
        "Estrutura de pontuação carregada com sucesso",
        result
      )
    } catch (error) {
      console.error("Erro ao listar estrutura de pontuação:", error)

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null
        )
        return
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

   public salvarPontuacaoItem: RequestHandler = async (req, res, _next) => {
    try {
      const userId = this.extrairUserId(req)
      if (!userId) {
        HttpResponse.unauthorized(res)
        return
      }

      const processId = Number(req.params.id)
      const itemId = Number(req.params.itemId)

      if (!processId || Number.isNaN(processId) || !itemId || Number.isNaN(itemId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetros inválidos",
          null
        )
        return
      }

      const body = req.body as Partial<UpdateItemScoreDto>

      // 👇 NÃO obriga mais awardedPoints aqui.
      // Para itens sem máximo: só quantity importa.
      // Para itens com máximo: service valida se awardedPoints veio.
      const dto: UpdateItemScoreDto = {
        quantity: body.quantity ?? 0,
        awardedPoints:
          body.awardedPoints !== undefined && body.awardedPoints !== null
            ? String(body.awardedPoints)
            : ""
      }

      const result = await this.service.salvarPontuacaoItem(
        processId,
        userId,
        itemId,
        dto
      )

      return HttpResponse.ok(
        res,
        "Pontuação do item salva com sucesso",
        result
      )
    } catch (error) {
      console.error("Erro ao salvar pontuação do item:", error)

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null
        )
        return
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  // ---------- ANEXAR EVIDÊNCIA (COM TRATAMENTO DO MULTER AQUI DENTRO) -------
  public anexarEvidencia: RequestHandler = (req, res, _next) => {
    const userId = this.extrairUserId(req)
    if (!userId) {
      HttpResponse.unauthorized(res)
      return
    }

    const processId = Number(req.params.id)
    const itemId = Number(req.params.itemId)

    if (!processId || Number.isNaN(processId) || !itemId || Number.isNaN(itemId)) {
      HttpResponse.badRequest(
        res,
        StatusCodeDescription.INVALID_INPUT,
        "Parâmetros inválidos",
        null
      )
      return
    }

    upload.single("file")(req, res, async err => {
      if (err) {
        console.error("Erro de upload (multer):", err)

        const anyErr = err as any

        if (anyErr.code === "LIMIT_FILE_SIZE") {
          HttpResponse.badRequest(
            res,
            StatusCodeDescription.INVALID_INPUT,
            "O arquivo excede o tamanho máximo permitido de 5MB.",
            null
          )
          return
        }

        if (
          anyErr instanceof Error &&
          anyErr.message ===
            "Tipo de arquivo não permitido. Envie PDF ou imagem JPG/PNG."
        ) {
          HttpResponse.badRequest(
            res,
            StatusCodeDescription.INVALID_INPUT,
            anyErr.message,
            null
          )
          return
        }

        HttpResponse.internalError(res)
        return
      }

      const file = (req as any).file as Express.Multer.File | undefined
      if (!file) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Arquivo de evidência é obrigatório",
          null
        )
        return
      }

      const webBasePath = `/uploads/${userId}/${processId}`

      try {
        const result = await this.service.anexarEvidencia({
          processId,
          userId,
          itemId,
          originalName: file.originalname,
          storedName: file.filename,
          filePath: file.path,
          webBasePath,
          mimeType: file.mimetype,
          sizeBytes: file.size
        })

        return HttpResponse.ok(
          res,
          "Evidência anexada com sucesso",
          result
        )
      } catch (error) {
        console.error("Erro ao anexar evidência:", error)

        if (error instanceof NotFoundError) {
          HttpResponse.badRequest(
            res,
            StatusCodeDescription.INVALID_INPUT,
            error.message,
            null
          )
          return
        }

        if (error instanceof BusinessRuleError) {
          const details = (error as any).details ?? null
          HttpResponse.badRequest(
            res,
            StatusCodeDescription.INVALID_INPUT,
            error.message,
            details
          )
          return
        }

        HttpResponse.internalError(res)
        return
      }
    })
  }

  public reusarEvidencia: RequestHandler = async (req, res, _next) => {
    try {
      const userId = this.extrairUserId(req)
      if (!userId) {
        HttpResponse.unauthorized(res)
        return
      }

      const processId = Number(req.params.id)
      const itemId = Number(req.params.itemId)
      const { evidenceFileId } = req.body as { evidenceFileId?: number }

      if (!processId || Number.isNaN(processId) || !itemId || Number.isNaN(itemId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetros inválidos",
          null
        )
        return
      }

      if (!evidenceFileId || Number.isNaN(Number(evidenceFileId))) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          '"evidenceFileId" é obrigatório',
          null
        )
        return
      }

      const result = await this.service.vincularEvidenciaExistente({
        processId,
        userId,
        itemId,
        evidenceFileId: Number(evidenceFileId)
      })

      return HttpResponse.ok(
        res,
        "Evidência reutilizada com sucesso",
        result
      )
    } catch (error) {
      console.error("Erro ao reutilizar evidência:", error)

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null
        )
        return
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public listarArquivosUsuario: RequestHandler = async (req, res, _next) => {
    try {
      const userId = this.extrairUserId(req)
      if (!userId) {
        HttpResponse.unauthorized(res)
        return
      }

      const result = await this.service.listarArquivosDoUsuario(userId)

      return HttpResponse.ok(
        res,
        "Arquivos de evidência listados com sucesso",
        result
      )
    } catch (error) {
      console.error("Erro ao listar arquivos de evidência do usuário:", error)
      HttpResponse.internalError(res)
      return
    }
  }

    public obterConteudoEvidencia: RequestHandler = async (req, res, _next) => {
    try {
      const userId = this.extrairUserId(req)
      if (!userId) {
        HttpResponse.unauthorized(res)
        return
      }

      const evidenceFileId = Number(req.params.evidenceFileId)
      if (!evidenceFileId || Number.isNaN(evidenceFileId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de evidência inválido",
          null
        )
        return
      }

      const { filePath, originalName, mimeType } =
        await this.service.obterEvidenciaConteudo(evidenceFileId, userId)

      res.setHeader("Content-Type", mimeType || "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(originalName)}"`
      )

      const stream = fs.createReadStream(filePath)
      stream.on("error", err => {
        console.error("Erro ao ler arquivo de evidência:", err)
        if (!res.headersSent) {
          HttpResponse.internalError(res)
        } else {
          res.end()
        }
      })

      stream.pipe(res)
    } catch (error) {
      console.error("Erro ao obter conteúdo da evidência:", error)

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null
        )
        return
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

}
