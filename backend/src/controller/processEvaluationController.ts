import path from "path"
import fs from "fs"
import { prisma } from "../infra/prismaClient"
import { RequestHandler } from "express"
import { RoleName } from "@prisma/client"
import { ProcessEvaluationService } from "../service/processEvaluationService"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { BusinessRuleError, NotFoundError } from "../service/processoService"
import {
  CppdItemScoreDto,
  FinalizeEvaluationDto
} from "../type/dto/processEvaluationDto"

export class ProcessEvaluationController {
  constructor(private readonly service: ProcessEvaluationService) { }

  private getAuthFromRequest(req: any): { userId: number; selectedRole: RoleName | null } | null {
    const payload = req.user as any

    if (!payload) {
      return null
    }

    const userId = Number(payload.sub)
    if (!userId || Number.isNaN(userId)) {
      return null
    }

    const selectedRole = (payload.selectedRole as RoleName) ?? null

    return {
      userId,
      selectedRole
    }
  }

  private ensureCppdMember(req: any, res: any): { userId: number } | null {
    const auth = this.getAuthFromRequest(req)
    if (!auth) {
      HttpResponse.unauthorized(res)
      return null
    }

    if (auth.selectedRole !== RoleName.CPPD_MEMBER) {
      HttpResponse.badRequest(
        res,
        StatusCodeDescription.INVALID_INPUT,
        "Access allowed only for CPPD members",
        null
      )
      return null
    }

    return { userId: auth.userId }
  }

  // GET /processes/:id/evaluation
  public getProcessForEvaluation: RequestHandler = async (req, res, _next) => {
    try {
      const auth = this.ensureCppdMember(req, res)
      if (!auth) return

      const processId = Number(req.params.id)
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Invalid process id",
          null
        )
        return
      }

      const result = await this.service.getProcessForEvaluation(processId)

      return HttpResponse.ok(
        res,
        "Process loaded for CPPD evaluation",
        result
      )
    } catch (error) {
      console.error("Error loading process for evaluation:", error)

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
    }
  }

  // PATCH /processes/:id/evaluation/items
  public updateItemScores: RequestHandler = async (req, res, _next) => {
    try {
      const auth = this.ensureCppdMember(req, res)
      if (!auth) return

      const processId = Number(req.params.id)
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Invalid process id",
          null
        )
        return
      }

      const body = req.body as { scores?: CppdItemScoreDto[] }
      const updates: CppdItemScoreDto[] = Array.isArray(body.scores) ? body.scores : []

      const result = await this.service.updateItemScores(processId, updates)

      return HttpResponse.ok(
        res,
        "Item scores updated by CPPD",
        result
      )
    } catch (error) {
      console.error("Error updating item scores by CPPD:", error)

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
    }
  }

  // POST /processes/:id/evaluation/finalize
  public finalizeEvaluation: RequestHandler = async (req, res, _next) => {
    try {
      const auth = this.ensureCppdMember(req, res)
      if (!auth) return

      const processId = Number(req.params.id)
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Invalid process id",
          null
        )
        return
      }

      const body = req.body as FinalizeEvaluationDto

      if (!body || !body.decision) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "CPPD decision is required",
          null
        )
        return
      }

      const updated = await this.service.finalizeEvaluation(
        processId,
        auth.userId,
        body
      )

      return HttpResponse.ok(
        res,
        "CPPD evaluation finalized successfully",
        updated
      )
    } catch (error) {
      console.error("Error finalizing CPPD evaluation:", error)

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
    }
  }

  // GET /processes/:id/evaluation/evidences/:evidenceFileId/conteudo
  public getEvidenceContentForCppd: RequestHandler = async (req, res, _next) => {
    try {
      const auth = this.ensureCppdMember(req, res)
      if (!auth) return

      const processId = Number(req.params.id)
      const evidenceFileId = Number(req.params.evidenceFileId)

      if (
        !processId ||
        Number.isNaN(processId) ||
        !evidenceFileId ||
        Number.isNaN(evidenceFileId)
      ) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetros inválidos",
          null
        )
        return
      }

      // 🔹 Renomeado para NÃO sombrear o process global do Node
      const careerProcess = await prisma.careerProcess.findFirst({
        where: {
          idProcess: processId,
          deletedDate: null
        }
      })

      if (!careerProcess) {
        throw new NotFoundError("Processo não encontrado")
      }

      const file = await prisma.evidenceFile.findFirst({
        where: {
          idEvidenceFile: evidenceFileId,
          deletedDate: null
        }
      })

      if (!file) {
        throw new NotFoundError("Arquivo de evidência não encontrado")
      }

      const score = await prisma.processScore.findFirst({
        where: {
          processId,
          evidenceFileId,
          deletedDate: null
        }
      })

      if (!score) {
        throw new BusinessRuleError(
          "Esta evidência não está vinculada ao processo informado."
        )
      }

      if (!file.url || !file.url.startsWith("/uploads/")) {
        throw new BusinessRuleError("Caminho do arquivo de evidência inválido.")
      }

      // 🔹 Aqui agora o `process` é o global do Node
      const uploadsRoot = path.join(process.cwd(), "uploads")
      const relativePath = file.url.replace("/uploads/", "")
      const filePath = path.join(uploadsRoot, relativePath)

      if (!fs.existsSync(filePath)) {
        throw new NotFoundError("Arquivo de evidência não encontrado no servidor.")
      }

      res.setHeader("Content-Type", file.mimeType ?? "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(file.originalName)}"`
      )

      const stream = fs.createReadStream(filePath)
      stream.on("error", err => {
        console.error("Erro ao ler arquivo de evidência (CPPD):", err)
        if (!res.headersSent) {
          HttpResponse.internalError(res)
        } else {
          res.end()
        }
      })

      stream.pipe(res)
    } catch (error) {
      console.error("Erro ao obter conteúdo da evidência para CPPD:", error)

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
