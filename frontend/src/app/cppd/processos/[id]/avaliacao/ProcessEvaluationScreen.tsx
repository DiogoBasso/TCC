"use client"

import { useEffect, useMemo, useState } from "react"

type CppdDecision = "APPROVED" | "REJECTED" | "RETURNED"

interface EvidenceFileDto {
  idEvidenceFile: number
  originalName: string
  url: string
  sizeBytes: string | null
}

interface EvaluationScoreDto {
  idProcessScore: number
  itemId: number
  quantity: number
  awardedPoints: number
  evaluatorAwardedPoints: number | null
  evaluatorComment: string | null
  evidenceFile: EvidenceFileDto | null
}

interface EvaluationItemDto {
  idScoringItem: number
  nodeId: number
  description: string
  points: number
  unit: string | null
  hasMaxPoints: boolean
  maxPoints: number | null
}

interface EvaluationNodeDto {
  idScoringNode: number
  parentId: number | null
  name: string
  code: string | null
  sortOrder: number
  hasFormula: boolean
}

interface EvaluationProcessInfoDto {
  idProcess: number
  type: "PROGRESSAO" | "PROMOCAO"
  status: string
  campus: string
  cidadeUF: string
  intersticeStart: string
  intersticeEnd: string
  classeOrigem: string
  nivelOrigem: string
  classeDestino: string
  nivelDestino: string
  teacherName: string
}

interface EvaluationNodeScoreDto {
  nodeId: number
  totalPoints: number
  evaluatorTotalPoints: number | null
}

interface ProcessEvaluationViewDto {
  process: EvaluationProcessInfoDto
  nodes: EvaluationNodeDto[]
  items: EvaluationItemDto[]
  scores: EvaluationScoreDto[]
  nodeScores: EvaluationNodeScoreDto[]
}

interface CppdItemScoreDto {
  itemId: number
  evaluatorAwardedPoints: string | null
  evaluatorComment?: string | null
}

interface FinalizeEvaluationDto {
  decision: CppdDecision
  evaluatorUserIds?: number[]
  overrideOpinion?: string | null
}

interface ProcessEvaluationScreenProps {
  processId: number
}

/**
 * Helpers de API — adapta a URL para como tu já usa hoje.
 */
async function fetchEvaluation(processId: number): Promise<ProcessEvaluationViewDto> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
  const res = await fetch(`${baseUrl}/processes/${processId}/evaluation`, {
    credentials: "include"
  })

  if (!res.ok) {
    throw new Error("Falha ao carregar processo para avaliação")
  }

  const body = await res.json()
  return body.data as ProcessEvaluationViewDto
}

async function patchItemScores(
  processId: number,
  scores: CppdItemScoreDto[]
): Promise<ProcessEvaluationViewDto> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
  const res = await fetch(`${baseUrl}/processes/${processId}/evaluation/items`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ scores })
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.message ?? "Falha ao salvar pontuações"
    throw new Error(msg)
  }

  const body = await res.json()
  return body.data as ProcessEvaluationViewDto
}

async function finalizeEvaluationApi(
  processId: number,
  dto: FinalizeEvaluationDto
) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
  const res = await fetch(`${baseUrl}/processes/${processId}/evaluation/finalize`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(dto)
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.message ?? "Falha ao finalizar avaliação"
    throw new Error(msg)
  }

  const body = await res.json()
  return body.data as {
    idProcess: number
    status: string
    finalPoints: number | null
    evaluationOpinion: string | null
    evaluatorUserIds: unknown
  }
}

export default function ProcessEvaluationScreen({ processId }: ProcessEvaluationScreenProps) {
  const [data, setData] = useState<ProcessEvaluationViewDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)

  const [editedScores, setEditedScores] = useState<
    Record<number, { evaluatorAwardedPoints: string; evaluatorComment: string }>
  >({})

  // estado para finalizar avaliação
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [finalizeDecision, setFinalizeDecision] = useState<CppdDecision | "">("")
  const [finalizeOpinion, setFinalizeOpinion] = useState("")
  const [finalizeLoading, setFinalizeLoading] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [finalizeSuccess, setFinalizeSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await fetchEvaluation(processId)
        if (cancelled) return

        setData(result)

        const initial: Record<number, { evaluatorAwardedPoints: string; evaluatorComment: string }> = {}
        result.scores.forEach(score => {
          initial[score.itemId] = {
            evaluatorAwardedPoints:
              score.evaluatorAwardedPoints !== null && score.evaluatorAwardedPoints !== undefined
                ? String(score.evaluatorAwardedPoints)
                : "",
            evaluatorComment: score.evaluatorComment ?? ""
          }
        })
        setEditedScores(initial)
        setCurrentIndex(0)
      } catch (err: any) {
        console.error(err)
        if (!cancelled) setError(err.message ?? "Erro ao carregar dados")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [processId])

  const orderedItems = useMemo(() => {
    if (!data) return []

    const nodeOrder = new Map<number, number>()
    const nodeNameById = new Map<number, string>()
    data.nodes.forEach(n => {
      nodeOrder.set(n.idScoringNode, n.sortOrder)
      nodeNameById.set(n.idScoringNode, n.name)
    })

    const scoresByItemId = new Map<number, EvaluationScoreDto>()
    data.scores.forEach(s => {
      scoresByItemId.set(s.itemId, s)
    })

    const itemsWithScore = data.items.map(item => {
      const score = scoresByItemId.get(item.idScoringItem) ?? null
      return {
        item,
        score,
        nodeSortOrder: nodeOrder.get(item.nodeId) ?? 0,
        nodeName: nodeNameById.get(item.nodeId) ?? ""
      }
    })

    itemsWithScore.sort((a, b) => {
      if (a.nodeSortOrder !== b.nodeSortOrder) {
        return a.nodeSortOrder - b.nodeSortOrder
      }
      return a.item.idScoringItem - b.item.idScoringItem
    })

    return itemsWithScore
  }, [data])

  const current = orderedItems[currentIndex] ?? null

  const teacherTotal = useMemo(() => {
    if (!data) return 0
    return data.scores.reduce((acc, s) => acc + s.awardedPoints, 0)
  }, [data])

  const cppdTotal = useMemo(() => {
    if (!data) return 0
    return data.scores.reduce((acc, s) => {
      const val =
        s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
          ? s.evaluatorAwardedPoints
          : s.awardedPoints
      return acc + val
    }, 0)
  }, [data])

  const handleChangeScore = (
    itemId: number,
    field: "evaluatorAwardedPoints" | "evaluatorComment",
    value: string
  ) => {
    setEditedScores(prev => ({
      ...prev,
      [itemId]: {
        evaluatorAwardedPoints: prev[itemId]?.evaluatorAwardedPoints ?? "",
        evaluatorComment: prev[itemId]?.evaluatorComment ?? "",
        [field]: value
      }
    }))
  }

  const applyUpdatedData = (updated: ProcessEvaluationViewDto) => {
    setData(updated)

    const refreshed: Record<number, { evaluatorAwardedPoints: string; evaluatorComment: string }> = {}
    updated.scores.forEach(score => {
      refreshed[score.itemId] = {
        evaluatorAwardedPoints:
          score.evaluatorAwardedPoints !== null && score.evaluatorAwardedPoints !== undefined
            ? String(score.evaluatorAwardedPoints)
            : "",
        evaluatorComment: score.evaluatorComment ?? ""
      }
    })
    setEditedScores(refreshed)
  }

  const handleSaveCurrent = async () => {
    if (!data || !current) return

    const itemId = current.item.idScoringItem
    const edit = editedScores[itemId] ?? {
      evaluatorAwardedPoints: "",
      evaluatorComment: ""
    }

    const payload: CppdItemScoreDto[] = [
      {
        itemId,
        evaluatorAwardedPoints:
          edit.evaluatorAwardedPoints.trim() === "" ? null : edit.evaluatorAwardedPoints.trim(),
        evaluatorComment:
          edit.evaluatorComment.trim() === "" ? null : edit.evaluatorComment
      }
    ]

    try {
      setSaving(true)
      setError(null)
      const updated = await patchItemScores(processId, payload)
      applyUpdatedData(updated)
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "Erro ao salvar pontuação")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    if (!data || orderedItems.length === 0) return

    const payload: CppdItemScoreDto[] = orderedItems.map(row => {
      const itemId = row.item.idScoringItem
      const edit = editedScores[itemId] ?? {
        evaluatorAwardedPoints: "",
        evaluatorComment: ""
      }

      return {
        itemId,
        evaluatorAwardedPoints:
          edit.evaluatorAwardedPoints.trim() === "" ? null : edit.evaluatorAwardedPoints.trim(),
        evaluatorComment:
          edit.evaluatorComment.trim() === "" ? null : edit.evaluatorComment
      }
    })

    try {
      setSaving(true)
      setError(null)
      const updated = await patchItemScores(processId, payload)
      applyUpdatedData(updated)
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "Erro ao salvar pontuações")
    } finally {
      setSaving(false)
    }
  }

  const handlePrev = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev))
  }

  const handleNext = () => {
    setCurrentIndex(prev => {
      if (prev < orderedItems.length - 1) return prev + 1
      return prev
    })
  }

  const handleOpenFinalize = () => {
    setFinalizeOpen(true)
    setFinalizeError(null)
    setFinalizeSuccess(null)
  }

  const handleConfirmFinalize = async () => {
    if (!finalizeDecision) {
      setFinalizeError("Selecione uma decisão da CPPD.")
      return
    }

    try {
      setFinalizeLoading(true)
      setFinalizeError(null)
      setFinalizeSuccess(null)

      const dto: FinalizeEvaluationDto = {
        decision: finalizeDecision,
        // se quiser registrar avaliadores explicitamente depois, é só preencher aqui
        evaluatorUserIds: undefined,
        overrideOpinion:
          finalizeOpinion.trim() === "" ? null : finalizeOpinion.trim()
      }

      const result = await finalizeEvaluationApi(processId, dto)

      setFinalizeSuccess(
        `Avaliação finalizada com status ${result.status} e pontuação final ${
          result.finalPoints !== null ? result.finalPoints.toFixed(2) : "—"
        }.`
      )
    } catch (err: any) {
      console.error(err)
      setFinalizeError(err.message ?? "Erro ao finalizar avaliação")
    } finally {
      setFinalizeLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <p className="text-[var(--text-secondary)] text-sm">
          Carregando informações do processo…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                      rounded-2xl p-6">
        <p className="text-[var(--state-danger-text)] text-sm">
          {error}
        </p>
      </div>
    )
  }

  if (!data || orderedItems.length === 0) {
    return (
      <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                      rounded-2xl p-6">
        <p className="text-[var(--text-secondary)] text-sm">
          Não há itens de pontuação cadastrados para este processo.
        </p>
      </div>
    )
  }

  const process = data.process
  const currentScore = current?.score ?? null
  const currentEdit = current
    ? editedScores[current.item.idScoringItem] ?? {
        evaluatorAwardedPoints: "",
        evaluatorComment: ""
      }
    : { evaluatorAwardedPoints: "", evaluatorComment: "" }

  const currentEvidence = currentScore?.evidenceFile ?? null
  const positionLabel = `${currentIndex + 1} de ${orderedItems.length}`

  // map nodeScores para exibir no card lateral de blocos
  const nodeById = new Map<number, EvaluationNodeDto>()
  data.nodes.forEach(n => nodeById.set(n.idScoringNode, n))

  const orderedNodeScores = [...data.nodeScores].sort((a, b) => {
    const nodeA = nodeById.get(a.nodeId)
    const nodeB = nodeById.get(b.nodeId)
    const sortA = nodeA?.sortOrder ?? 0
    const sortB = nodeB?.sortOrder ?? 0
    return sortA - sortB
  })

  return (
    <div className="space-y-6">
      {/* Cabeçalho da avaliação */}
      <header className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Avaliação do processo #{process.idProcess}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Docente: <span className="font-medium">{process.teacherName}</span> ·{" "}
            Campus: {process.campus} · {process.cidadeUF}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Interstício:{" "}
            {new Date(process.intersticeStart).toLocaleDateString("pt-BR")}
            {"  –  "}
            {new Date(process.intersticeEnd).toLocaleDateString("pt-BR")}
            {"  ·  "}
            {process.classeOrigem}{process.nivelOrigem} → {process.classeDestino}{process.nivelDestino}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold
                           bg-[var(--chip-bg)] text-[var(--chip-text)]">
            {process.type === "PROGRESSAO" ? "Progressão" : "Promoção"}
          </span>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide
                       bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                       hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-60
                       transition-[background,opacity]"
          >
            {saving ? "Salvando…" : "Salvar tudo"}
          </button>

          <button
            type="button"
            onClick={handleOpenFinalize}
            className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide
                       border border-[var(--border-subtle)]
                       text-[var(--text-primary)]
                       hover:border-[var(--border-strong)] transition"
          >
            Finalizar avaliação
          </button>
        </div>
      </header>

      {/* Resumo de pontuação */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                        rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-1">
            Total do docente
          </p>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            {teacherTotal.toFixed(2)} <span className="text-sm">pts</span>
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Soma de todos os pontos calculados com base nos dados preenchidos pelo docente.
          </p>
        </div>

        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                        rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-1">
            Total CPPD (parcial)
          </p>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            {cppdTotal.toFixed(2)} <span className="text-sm">pts</span>
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Soma de todas as pontuações avaliadas pela CPPD (quando vazio, usa o valor do docente).
          </p>
        </div>

        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                        rounded-2xl p-4 hidden lg:block">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-1">
            Status atual
          </p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {process.status}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            O processo só pode ser finalizado se estiver em SUBMITTED ou UNDER_REVIEW.
          </p>
        </div>
      </section>

      {/* Layout principal */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.1fr)]">
        {/* Coluna esquerda: lista de itens + blocos */}
        <div className="space-y-4">
          {/* Itens */}
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                          rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Itens de pontuação
              </h2>
              <span className="text-[11px] text-[var(--text-secondary)]">
                {positionLabel}
              </span>
            </div>

            <div className="max-h-[320px] overflow-y-auto pr-1 space-y-1">
              {orderedItems.map((row, index) => {
                const isActive = index === currentIndex
                const s = row.score
                const teacherPts = s ? s.awardedPoints : 0
                const cppdPts =
                  s && s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
                    ? s.evaluatorAwardedPoints
                    : null

                return (
                  <button
                    key={row.item.idScoringItem}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`w-full text-left rounded-xl px-3 py-2 text-xs
                               border transition
                               ${
                                 isActive
                                   ? "border-[var(--border-strong)] bg-[var(--surface-muted)]"
                                   : "border-[var(--border-subtle)] hover:bg-[var(--surface-muted)]"
                               }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        {row.item.description}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                      <span>Docente: {teacherPts.toFixed(2)}</span>
                      <span>
                        CPPD: {cppdPts !== null ? cppdPts.toFixed(2) : "—"}
                      </span>
                      <span className="truncate max-w-[160px]">
                        Bloco: {row.nodeName}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="pt-2 flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="rounded-full px-3 py-1.5 text-xs font-semibold
                           bg-[var(--navbar-chip-bg)] text-[var(--navbar-text)]
                           hover:bg-[var(--navbar-chip-hover-bg)]
                           disabled:opacity-50 transition"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex >= orderedItems.length - 1}
                className="rounded-full px-3 py-1.5 text-xs font-semibold
                           bg-[var(--navbar-chip-bg)] text-[var(--navbar-text)]
                           hover:bg-[var(--navbar-chip-hover-bg)]
                           disabled:opacity-50 transition"
              >
                Próximo
              </button>
            </div>
          </div>

          {/* Totais por bloco */}
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                          rounded-2xl p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
              Totais por bloco
            </h3>
            <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
              {orderedNodeScores.map(ns => {
                const node = nodeById.get(ns.nodeId)
                if (!node) return null

                const teacher = ns.totalPoints
                const cppd =
                  ns.evaluatorTotalPoints !== null && ns.evaluatorTotalPoints !== undefined
                    ? ns.evaluatorTotalPoints
                    : null

                return (
                  <div
                    key={ns.nodeId}
                    className="flex items-center justify-between text-[11px]
                               rounded-lg px-2 py-1 hover:bg-[var(--surface-muted)]"
                  >
                    <span className="truncate max-w-[200px]">
                      {node.name}
                    </span>
                    <span className="flex gap-2">
                      <span className="text-[var(--text-secondary)]">
                        D: {teacher.toFixed(2)}
                      </span>
                      <span className="text-[var(--text-primary)]">
                        C: {cppd !== null ? cppd.toFixed(2) : "—"}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Coluna central: item atual */}
        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                        rounded-2xl p-5 space-y-4">
          {current && (
            <>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-1">
                  Item de pontuação
                </p>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {current.item.description}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Valor base: {current.item.points.toFixed(2)} ponto(s)
                  {current.item.unit ? ` · Unidade: ${current.item.unit}` : ""}
                  {current.item.hasMaxPoints && current.item.maxPoints !== null
                    ? ` · Máximo: ${current.item.maxPoints.toFixed(2)} pts`
                    : ""}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Docente */}
                <div className="rounded-xl bg-[var(--surface-muted)]
                                border border-[var(--border-subtle)] p-4 space-y-2">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    Pontuação do docente
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-[var(--text-primary)]">
                      {currentScore ? currentScore.awardedPoints.toFixed(2) : "0,00"}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      pontos
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Este valor é calculado com base na quantidade informada pelo docente
                    e não pode ser alterado nesta etapa.
                  </p>
                </div>

                {/* CPPD */}
                <div className="rounded-xl bg-[var(--surface-muted)]
                                border border-[var(--border-subtle)] p-4 space-y-3">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    Pontuação da CPPD
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currentEdit.evaluatorAwardedPoints}
                      onChange={e =>
                        handleChangeScore(
                          current.item.idScoringItem,
                          "evaluatorAwardedPoints",
                          e.target.value
                        )
                      }
                      className="w-28 rounded-lg border border-[var(--border-subtle)]
                                 bg-[var(--surface-bg)] px-2 py-1 text-sm
                                 text-[var(--text-primary)] outline-none
                                 focus:border-[var(--border-strong)]"
                      placeholder="Ex: 10"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">
                      pontos
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[var(--text-secondary)]">
                      Comentário da CPPD (opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={currentEdit.evaluatorComment}
                      onChange={e =>
                        handleChangeScore(
                          current.item.idScoringItem,
                          "evaluatorComment",
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-[var(--border-subtle)]
                                 bg-[var(--surface-bg)] px-2 py-1 text-sm
                                 text-[var(--text-primary)] outline-none
                                 focus:border-[var(--border-strong)] resize-none"
                      placeholder="Registre a fundamentação da pontuação atribuída, se necessário."
                    />
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveCurrent}
                      disabled={saving}
                      className="rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide
                                 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                 hover:bg-[var(--btn-primary-hover-bg)]
                                 disabled:opacity-60 transition-[background,opacity]"
                    >
                      {saving ? "Salvando…" : "Salvar item"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Coluna direita: comprovante */}
        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                        rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Comprovante do item
          </h2>

          {!currentEvidence && (
            <p className="text-xs text-[var(--text-secondary)]">
              Nenhum comprovante foi anexado para este item.
            </p>
          )}

          {currentEvidence && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-secondary)]">
                Arquivo:{" "}
                <span className="font-medium">
                  {currentEvidence.originalName}
                </span>
              </p>

              <a
                href={currentEvidence.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-xs text-[var(--accent-text)]
                           hover:underline"
              >
                Abrir em nova aba
              </a>

              <div className="mt-2 rounded-xl border border-[var(--border-subtle)]
                              bg-[var(--surface-muted)] overflow-hidden max-h-[420px]">
                {/* Sem mimeType no DTO, então tentamos embutir via iframe.
                    Se o navegador não conseguir, o link acima resolve. */}
                <iframe
                  src={currentEvidence.url}
                  className="w-full h-[380px]"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal de finalização */}
      {finalizeOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center
                        bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface-bg)]
                          border border-[var(--border-subtle)] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Finalizar avaliação
            </h2>

            <p className="text-sm text-[var(--text-secondary)]">
              Escolha a decisão da CPPD para este processo e, se necessário,
              registre um parecer resumido. Ao confirmar, o status do processo será
              atualizado.
            </p>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                Decisão
              </span>
              <div className="flex flex-col gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="cppd-decision"
                    value="APPROVED"
                    checked={finalizeDecision === "APPROVED"}
                    onChange={() => setFinalizeDecision("APPROVED")}
                  />
                  Aprovar (APPROVED)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="cppd-decision"
                    value="REJECTED"
                    checked={finalizeDecision === "REJECTED"}
                    onChange={() => setFinalizeDecision("REJECTED")}
                  />
                  Indeferir (REJECTED)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="cppd-decision"
                    value="RETURNED"
                    checked={finalizeDecision === "RETURNED"}
                    onChange={() => setFinalizeDecision("RETURNED")}
                  />
                  Devolver para ajustes (RETURNED)
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[var(--text-secondary)]">
                Parecer da CPPD (opcional)
              </label>
              <textarea
                rows={3}
                value={finalizeOpinion}
                onChange={e => setFinalizeOpinion(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)]
                           bg-[var(--surface-muted)] px-2 py-1 text-sm
                           text-[var(--text-primary)] outline-none
                           focus:border-[var(--border-strong)] resize-none"
                placeholder="Ex: Pontuações conferidas e ajustadas conforme documentação apresentada."
              />
            </div>

            {finalizeError && (
              <p className="text-xs text-[var(--state-danger-text)]">
                {finalizeError}
              </p>
            )}

            {finalizeSuccess && (
              <p className="text-xs text-[var(--state-success-text)]">
                {finalizeSuccess}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFinalizeOpen(false)}
                disabled={finalizeLoading}
                className="rounded-full px-4 py-1.5 text-xs font-semibold
                           border border-[var(--border-subtle)]
                           text-[var(--text-primary)]
                           hover:border-[var(--border-strong)] transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalize}
                disabled={finalizeLoading}
                className="rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide
                           bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                           hover:bg-[var(--btn-primary-hover-bg)]
                           disabled:opacity-60 transition-[background,opacity]"
              >
                {finalizeLoading ? "Finalizando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
