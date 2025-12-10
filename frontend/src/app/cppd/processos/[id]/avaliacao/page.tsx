"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"

type ProcessStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"

type ProcessType = "PROGRESSAO" | "PROMOCAO"

interface EvaluationProcessInfoDto {
  idProcess: number
  type: ProcessType
  status: ProcessStatus
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

interface EvaluationNodeDto {
  idScoringNode: number
  parentId: number | null
  name: string
  code: string | null
  sortOrder: number
  hasFormula: boolean
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

interface EvaluationScoreDto {
  idProcessScore: number
  itemId: number
  quantity: number
  awardedPoints: number
  evaluatorAwardedPoints: number | null
  evaluatorComment: string | null
  evidenceFile?: {
    idEvidenceFile: number
    originalName: string
    url: string
    sizeBytes: string | null
  } | null
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

type CppdDecision = "APPROVED" | "REJECTED" | "RETURNED"

interface CppdItemScoreDto {
  itemId: number
  evaluatorAwardedPoints: string | null
  evaluatorComment?: string | null
}

interface ApiResponse<T = any> {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

// ---------- Helpers ----------

function formatDateISOToBr(iso: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("pt-BR")
}

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return ""
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatPointsToInput(value: number | null | undefined) {
  if (value === null || value === undefined) return ""
  return String(value).replace(".", ",")
}

function docentePreencheu(score: EvaluationScoreDto | null | undefined) {
  if (!score) return false
  const qty = score.quantity ?? 0
  const pts = score.awardedPoints ?? 0
  return qty > 0 || pts > 0
}

function itemAvaliado(score: EvaluationScoreDto | null | undefined) {
  if (!score) return false
  return (
    score.evaluatorAwardedPoints !== null &&
    score.evaluatorAwardedPoints !== undefined
  )
}

// ---------- Árvore de blocos ----------

type TreeNode = {
  nodeId: number
  name: string
  code: string | null
  parentId: number | null
  sortOrder: number
  hasFormula: boolean
  items: EvaluationItemDto[]
  children: TreeNode[]
}

function buildTree(
  nodes: EvaluationNodeDto[],
  items: EvaluationItemDto[]
): TreeNode[] {
  const map = new Map<number, TreeNode>()

  nodes.forEach(n => {
    map.set(n.idScoringNode, {
      nodeId: n.idScoringNode,
      name: n.name,
      code: n.code,
      parentId: n.parentId,
      sortOrder: n.sortOrder,
      hasFormula: n.hasFormula,
      items: [],
      children: []
    })
  })

  const itemsByNode = new Map<number, EvaluationItemDto[]>()
  items.forEach(it => {
    const list = itemsByNode.get(it.nodeId) ?? []
    list.push(it)
    itemsByNode.set(it.nodeId, list)
  })

  map.forEach(node => {
    node.items =
      itemsByNode.get(node.nodeId)?.sort(
        (a, b) => a.idScoringItem - b.idScoringItem
      ) ?? []
  })

  const roots: TreeNode[] = []

  map.forEach(node => {
    if (node.parentId === null || node.parentId === undefined) {
      roots.push(node)
    } else {
      const parent = map.get(node.parentId)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
  })

  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder)
    nodes.forEach(n => sortTree(n.children))
  }

  sortTree(roots)
  return roots
}

type ItemState = {
  evaluatorPointsInput: string
  evaluatorCommentInput: string
}

type ItemStateMap = Record<number, ItemState>

export default function CppdAvaliacaoPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const processId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const [view, setView] = useState<ProcessEvaluationViewDto | null>(null)
  const [itemState, setItemState] = useState<ItemStateMap>({})
  const [activeItemId, setActiveItemId] = useState<number | null>(null)

  const decision: CppdDecision = "APPROVED"

  useEffect(() => {
    if (!Number.isFinite(processId)) return

    const load = async () => {
      setLoading(true)
      setError(null)
      setInfoMessage(null)

      try {
        const res = await fetch(`/api/cppd/processos/${processId}/avaliacao`, {
          method: "GET"
        })

        const payload: ApiResponse<ProcessEvaluationViewDto> = await res.json()

        if (!res.ok || payload.status === "error") {
          setError(payload.message || "Falha ao carregar processo para avaliação.")
          setView(null)
          return
        }

        if (!payload.data) {
          setError("Resposta sem dados ao carregar processo.")
          setView(null)
          return
        }

        const data = payload.data
        setView(data)

        const initialState: ItemStateMap = {}
        data.scores.forEach(score => {
          initialState[score.itemId] = {
            evaluatorPointsInput:
              score.evaluatorAwardedPoints !== null &&
              score.evaluatorAwardedPoints !== undefined
                ? formatPointsToInput(score.evaluatorAwardedPoints)
                : "",
            evaluatorCommentInput: score.evaluatorComment ?? ""
          }
        })
        setItemState(initialState)

        setActiveItemId(null)
      } catch (err) {
        console.error("Erro ao carregar avaliação CPPD:", err)
        setError("Erro inesperado ao carregar processo para avaliação.")
        setView(null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [processId])

  const scoreByItem = useMemo(() => {
    const map = new Map<number, EvaluationScoreDto>()
    if (view?.scores) {
      view.scores.forEach(s => map.set(s.itemId, s))
    }
    return map
  }, [view])

  const treeRoots: TreeNode[] = useMemo(() => {
    if (!view) return []
    return buildTree(view.nodes, view.items)
  }, [view])

  function computeNodeTotals(node: TreeNode) {
    let docente = 0
    let cppd = 0
    let hasCppd = false

    node.items.forEach(item => {
      const s = scoreByItem.get(item.idScoringItem)
      if (s) {
        docente += s.awardedPoints ?? 0
        if (
          s.evaluatorAwardedPoints !== null &&
          s.evaluatorAwardedPoints !== undefined
        ) {
          cppd += s.evaluatorAwardedPoints
          hasCppd = true
        }
      }
    })

    node.children.forEach(child => {
      const childTotals = computeNodeTotals(child)
      docente += childTotals.docente
      if (childTotals.cppd !== null) {
        cppd += childTotals.cppd
        hasCppd = true
      }
    })

    return {
      docente,
      cppd: hasCppd ? cppd : null
    }
  }

  const currentScore = useMemo(() => {
    if (activeItemId === null) return null
    return scoreByItem.get(activeItemId) ?? null
  }, [activeItemId, scoreByItem])

  const currentEvidence = currentScore?.evidenceFile ?? null
  const currentEvidenceUrl =
    currentEvidence != null
      ? `/api/cppd/processos/${processId}/avaliacao/evidencias/${currentEvidence.idEvidenceFile}/conteudo`
      : null

  const evaluationProgress = useMemo(() => {
    if (!view) {
      return {
        totalFilled: 0,
        totalEvaluated: 0,
        allEvaluated: false
      }
    }

    let totalFilled = 0
    let totalEvaluated = 0

    view.items.forEach(item => {
      const s = scoreByItem.get(item.idScoringItem)
      if (docentePreencheu(s)) {
        totalFilled += 1
        if (itemAvaliado(s)) {
          totalEvaluated += 1
        }
      }
    })

    return {
      totalFilled,
      totalEvaluated,
      allEvaluated: totalFilled > 0 && totalFilled === totalEvaluated
    }
  }, [view, scoreByItem])

  // ---------- Handlers ----------

  function handleChangeEvaluatorPoints(itemId: number, value: string) {
    setItemState(prev => ({
      ...prev,
      [itemId]: {
        evaluatorPointsInput: value,
        evaluatorCommentInput: prev[itemId]?.evaluatorCommentInput ?? ""
      }
    }))
  }

  function handleChangeEvaluatorComment(itemId: number, value: string) {
    setItemState(prev => ({
      ...prev,
      [itemId]: {
        evaluatorPointsInput: prev[itemId]?.evaluatorPointsInput ?? "",
        evaluatorCommentInput: value
      }
    }))
  }

  function handleSelectItem(itemId: number) {
    if (activeItemId !== null && activeItemId !== itemId) {
      setInfoMessage(
        "Conclua o item em avaliação (salvar ou cancelar) antes de selecionar outro."
      )
      return
    }

    const score = scoreByItem.get(itemId)

    if (!docentePreencheu(score)) {
      setInfoMessage(
        "Este item não foi preenchido pelo docente e não está disponível para avaliação."
      )
      return
    }

    setInfoMessage(null)

    setItemState(prev => {
      const copy = { ...prev }
      const current = copy[itemId] ?? {
        evaluatorPointsInput: "",
        evaluatorCommentInput: ""
      }

      const s = scoreByItem.get(itemId)

      // Preencher automaticamente com o valor do docente
      if (
        (!current.evaluatorPointsInput ||
          current.evaluatorPointsInput.trim() === "") &&
        s &&
        s.evaluatorAwardedPoints === null &&
        docentePreencheu(s)
      ) {
        copy[itemId] = {
          ...current,
          evaluatorPointsInput: formatPointsToInput(s.awardedPoints)
        }
      } else if (!copy[itemId]) {
        copy[itemId] = current
      }

      return copy
    })

    setActiveItemId(itemId)
  }

  function handleCancelItem(itemId: number) {
    const s = scoreByItem.get(itemId)

    setItemState(prev => ({
      ...prev,
      [itemId]: {
        evaluatorPointsInput:
          s && s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
            ? formatPointsToInput(s.evaluatorAwardedPoints)
            : "",
        evaluatorCommentInput: s?.evaluatorComment ?? ""
      }
    }))

    setActiveItemId(null)
    setInfoMessage(null)
  }

  async function handleSaveItem(itemId: number) {
    const local = itemState[itemId] ?? {
      evaluatorPointsInput: "",
      evaluatorCommentInput: ""
    }

    const rawPoints = local.evaluatorPointsInput.trim()
    const evaluatorPoints =
      rawPoints === ""
        ? null
        : Number(rawPoints.replace(".", "").replace(",", "."))

    if (
      rawPoints !== "" &&
      (evaluatorPoints === null || Number.isNaN(evaluatorPoints))
    ) {
      setError("Informe um valor numérico válido para os pontos da CPPD.")
      return
    }

    setSavingItem(true)
    setError(null)
    setInfoMessage(null)

    try {
      const payload: { scores: CppdItemScoreDto[] } = {
        scores: [
          {
            itemId,
            evaluatorAwardedPoints:
              evaluatorPoints === null ? null : evaluatorPoints.toString(),
            evaluatorComment:
              local.evaluatorCommentInput.trim() === ""
                ? null
                : local.evaluatorCommentInput.trim()
          }
        ]
      }

      const res = await fetch(
        `/api/cppd/processos/${processId}/avaliacao/itens`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      )

      const body: ApiResponse<ProcessEvaluationViewDto> = await res.json()

      if (!res.ok || body.status === "error") {
        setError(
          body.message ?? "Falha ao salvar pontuação do item para a CPPD."
        )
        return
      }

      if (body.data) {
        const data = body.data
        setView(data)

        const updatedScore = data.scores.find(s => s.itemId === itemId)

        setItemState(prev => ({
          ...prev,
          [itemId]: {
            evaluatorPointsInput:
              updatedScore &&
              updatedScore.evaluatorAwardedPoints !== null &&
              updatedScore.evaluatorAwardedPoints !== undefined
                ? formatPointsToInput(updatedScore.evaluatorAwardedPoints)
                : "",
            evaluatorCommentInput: updatedScore?.evaluatorComment ?? ""
          }
        }))
      }

      setInfoMessage("Pontuação do item salva com sucesso.")
      setActiveItemId(null)
    } catch (err) {
      console.error("Erro ao salvar pontuação do item CPPD:", err)
      setError("Erro inesperado ao salvar pontuação do item.")
    } finally {
      setSavingItem(false)
    }
  }

  async function handleFinalizeEvaluation() {
    if (!view) return

    if (!evaluationProgress.allEvaluated) {
      setInfoMessage(
        "Finalize a avaliação de todos os itens preenchidos pelo docente antes de concluir a avaliação do processo."
      )
      return
    }

    setFinalizing(true)
    setError(null)
    setInfoMessage(null)

    try {
      const payload = {
        decision,
        overrideOpinion: null as string | null
      }

      const res = await fetch(
        `/api/cppd/processos/${processId}/avaliacao/finalizar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      )

      const body: ApiResponse<{
        idProcess: number
        status: ProcessStatus
        finalPoints: number | null
        evaluationOpinion: string | null
        evaluatorUserIds: number[] | null
      }> = await res.json()

      if (!res.ok || body.status === "error") {
        setError(body.message ?? "Falha ao finalizar avaliação.")
        return
      }

      setInfoMessage("Avaliação finalizada com sucesso.")
      router.push(`/cppd/processos/${processId}/parecer`)
    } catch (err) {
      console.error("Erro ao finalizar avaliação CPPD:", err)
      setError("Erro inesperado ao finalizar avaliação.")
    } finally {
      setFinalizing(false)
    }
  }

  // ---------- Render ----------

  if (!Number.isFinite(processId)) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8">
          <p className="text-[var(--text-primary)]">
            ID de processo inválido.
          </p>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8">
          <p className="text-[var(--text-secondary)]">
            Carregando dados para avaliação da CPPD...
          </p>
        </div>
      </main>
    )
  }

  if (error && !view) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8 space-y-4">
          <p className="text-[var(--state-danger-text)] text-sm">
            {error}
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold
                       bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                       hover:bg-[var(--btn-primary-hover-bg)] transition"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    )
  }

  if (!view) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8">
          <p className="text-[var(--text-secondary)]">
            Nenhuma informação disponível para avaliação.
          </p>
        </div>
      </main>
    )
  }

  const process = view.process

  function renderItemRow(item: EvaluationItemDto) {
    const score = scoreByItem.get(item.idScoringItem) ?? null
    const isActive = activeItemId === item.idScoringItem
    const docenteFilled = docentePreencheu(score)
    const avaliado = itemAvaliado(score)

    const changedByCppd =
      avaliado &&
      docenteFilled &&
      score &&
      score.evaluatorAwardedPoints !== null &&
      Number(score.evaluatorAwardedPoints) !== Number(score.awardedPoints)

    const localState = itemState[item.idScoringItem] ?? {
      evaluatorPointsInput: "",
      evaluatorCommentInput: ""
    }

    const docentePoints = score?.awardedPoints ?? 0
    const cppdSavedPoints =
      score?.evaluatorAwardedPoints !== null &&
      score?.evaluatorAwardedPoints !== undefined
        ? score.evaluatorAwardedPoints
        : null

    const cppdPointsInline =
      score?.evaluatorAwardedPoints !== null &&
      score?.evaluatorAwardedPoints !== undefined
        ? score.evaluatorAwardedPoints
        : localState.evaluatorPointsInput
        ? Number(
            localState.evaluatorPointsInput
              .replace(".", "")
              .replace(",", ".")
          )
        : null

    const clickable = docenteFilled

    return (
      <div
        key={item.idScoringItem}
        className={
          "border border-[var(--border-subtle)] rounded-2xl p-3 bg-[var(--surface-muted-bg)] " +
          (clickable
            ? "hover:bg-[var(--surface-muted-hover)] cursor-pointer"
            : "opacity-70 cursor-not-allowed") +
          (isActive ? " ring-1 ring-[var(--border-strong)]" : "")
        }
        onClick={() => {
          if (!clickable) return
          if (!isActive) handleSelectItem(item.idScoringItem)
        }}
      >
        <div className="flex flex-col gap-2">
          {/* Cabeçalho do item + badges + DOCENTE / CPPD quando NÃO está em edição */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {avaliado && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium px-2 py-0.5 border border-emerald-100"
                  onClick={e => e.stopPropagation()}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Avaliado
                </span>
              )}

              {!avaliado && !docenteFilled && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium px-2 py-0.5 border border-amber-100"
                  onClick={e => e.stopPropagation()}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Docente não preencheu
                </span>
              )}

              {changedByCppd && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-medium px-2 py-0.5 border border-indigo-100"
                  onClick={e => e.stopPropagation()}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Pontuação alterada
                </span>
              )}

              <span className="text-sm font-medium text-[var(--text-primary)]">
                {item.description}
              </span>
            </div>

            {!isActive && (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                             bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                             text-[var(--text-primary)]"
                  onClick={e => e.stopPropagation()}
                >
                  Docente:{" "}
                  <span className="ml-1 font-semibold">
                    {formatNumber(docentePoints)} pts
                  </span>
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                             bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                             text-[var(--text-primary)]"
                  onClick={e => e.stopPropagation()}
                >
                  CPPD:{" "}
                  <span className="ml-1 font-semibold">
                    {cppdSavedPoints !== null
                      ? formatNumber(cppdSavedPoints)
                      : "—"}{" "}
                    pts
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Info de unidade / pontos base */}
          <div className="text-[11px] text-[var(--text-secondary)]">
            Unidade: {item.unit ?? "-"} · Pontos por unidade:{" "}
            <span className="font-medium">
              {formatNumber(item.points)}
            </span>
            {item.hasMaxPoints && item.maxPoints !== null && (
              <>
                {" "}
                · Máx:{" "}
                <span className="font-medium">
                  {formatNumber(item.maxPoints)}
                </span>{" "}
                pts
              </>
            )}
          </div>

          {/* Área de edição da CPPD (expande dentro do item) */}
          {isActive && docenteFilled && (
            <div
              className="mt-2 pt-2 border-t border-[var(--border-subtle)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col md:flex-row gap-3">
                {/* Docente + CPPD descendo para a área de edição */}
                <div className="w-full md:w-56">
                  <div className="mb-2">
                    <div className="text-[11px] text-[var(--text-secondary)] mb-0.5">
                      Pontos do docente
                    </div>
                    <div className="text-xs font-semibold text-[var(--text-primary)] px-3 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-bg)] inline-flex">
                      {formatNumber(docentePoints)} pts
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                      Avaliação da CPPD
                    </label>
                    <input
                      type="text"
                      value={localState.evaluatorPointsInput}
                      onChange={e =>
                        handleChangeEvaluatorPoints(
                          item.idScoringItem,
                          e.target.value
                        )
                      }
                      className="w-full text-xs rounded-full border border-[var(--border-subtle)]
                                 bg-[var(--surface-bg)] px-3 py-1.5
                                 text-right text-[var(--text-primary)]
                                 focus:outline-none focus:border-[var(--border-strong)]"
                      placeholder="0,00"
                    />
                  </div>

                  {cppdPointsInline !== null &&
                    !Number.isNaN(cppdPointsInline) && (
                      <div className="mt-1 text-[10px] text-[var(--text-secondary)]">
                        CPPD (atual):{" "}
                        <span className="font-semibold text-[var(--text-primary)]">
                          {formatNumber(cppdPointsInline)} pts
                        </span>
                      </div>
                    )}
                </div>

                {/* Comentário */}
                <div className="flex-1">
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Comentário (opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={localState.evaluatorCommentInput}
                    onChange={e =>
                      handleChangeEvaluatorComment(
                        item.idScoringItem,
                        e.target.value
                      )
                    }
                    className="w-full text-xs rounded-xl border border-[var(--border-subtle)]
                               bg-[var(--surface-bg)] px-3 py-2
                               text-[var(--text-primary)]
                               focus:outline-none focus:border-[var(--border-strong)]"
                    placeholder="Use este espaço para registrar observações sobre este item."
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 mt-3">
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-full border border-[var(--border-subtle)]
                             text-[11px] font-medium text-[var(--text-secondary)]
                             hover:bg-[var(--surface-muted)]"
                  onClick={() => handleCancelItem(item.idScoringItem)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-full text-[11px] font-semibold
                             bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                             hover:bg-[var(--btn-primary-hover-bg)]
                             disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={() => handleSaveItem(item.idScoringItem)}
                  disabled={savingItem}
                >
                  {savingItem ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderNode(node: TreeNode) {
    const label = node.code ? `${node.code} - ${node.name}` : node.name
    const totals = computeNodeTotals(node)

    return (
      <div key={node.nodeId} className="space-y-3">
        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
          {/* Cabeçalho do bloco */}
          <div className="flex justify-between items-center gap-2 mb-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {label}
              </div>
              {node.hasFormula && (
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Bloco com cálculo automático
                </div>
              )}
            </div>
          </div>

          {/* Itens */}
          {node.items.length > 0 && (
            <div className="space-y-3">
              {node.items.map(item => renderItemRow(item))}
            </div>
          )}

          {/* Filhos */}
          {node.children.length > 0 && (
            <div className="mt-4 border-l-2 border-dashed border-[var(--border-subtle)] pl-4 space-y-4">
              {node.children.map(child => renderNode(child))}
            </div>
          )}

          {node.items.length === 0 && node.children.length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              Nenhuma atividade cadastrada neste bloco.
            </p>
          )}

          {/* Rodapé – resumo único do bloco */}
          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-[var(--text-muted)]">
              Resumo deste bloco
            </div>
            <div className="flex flex-col items-end text-[11px]">
              <span className="text-[var(--text-secondary)]">
                Total de pontos (docente):
              </span>
              <span className="font-semibold text-[var(--text-primary)]">
                {formatNumber(totals.docente)} pts
              </span>
              <span className="mt-1 text-[var(--text-secondary)]">
                Total de pontos avaliados (CPPD):
              </span>
              <span className="font-semibold text-[var(--text-primary)]">
                {totals.cppd !== null ? formatNumber(totals.cppd) : "—"} pts
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const previewUrl = currentEvidenceUrl ?? ""

  return (
    <main className="min-h-[60vh]">
      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Cabeçalho */}
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Avaliação da CPPD
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Processo #{process.idProcess} · {process.teacherName}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {process.campus} · {process.cidadeUF} · Interstício{" "}
              {formatDateISOToBr(process.intersticeStart)} a{" "}
              {formatDateISOToBr(process.intersticeEnd)} ·{" "}
              {process.classeOrigem}
              {process.nivelOrigem} → {process.classeDestino}
              {process.nivelDestino}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-[11px] text-[var(--text-secondary)]">
              Itens preenchidos pelo docente:{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {evaluationProgress.totalEvaluated} /{" "}
                {evaluationProgress.totalFilled}
              </span>
            </div>
            <div className="flex gap-2">
              <Link
                href="/cppd"
                className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                           text-xs text-[var(--btn-secondary-text)]
                           hover:bg-[var(--btn-secondary-hover-bg)] transition"
              >
                Voltar
              </Link>
            </div>
          </div>
        </header>

        {/* Mensagens globais */}
        {(infoMessage || error) && (
          <div className="space-y-1">
            {infoMessage && (
              <p className="text-xs text-[var(--state-success-text)]">
                {infoMessage}
              </p>
            )}
            {error && (
              <p className="text-xs text-[var(--state-danger-text)]">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Layout principal: metade esquerda blocos, metade direita comprovante com painel fixo */}
        <section className="flex flex-col md:flex-row gap-4 md:items-start">
          {/* Coluna esquerda */}
          <div className="w-full md:w-1/2 space-y-4">
            {treeRoots.length === 0 && (
              <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm text-sm text-[var(--text-secondary)]">
                Nenhuma estrutura de pontuação definida para esta tabela.
              </div>
            )}

            {treeRoots.map(node => renderNode(node))}

            {evaluationProgress.allEvaluated && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleFinalizeEvaluation}
                  disabled={finalizing}
                  className="inline-flex items-center rounded-full px-5 py-2 text-xs font-semibold
                             bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                             hover:bg-[var(--btn-primary-hover-bg)]
                             disabled:opacity-60 disabled:cursor-not-allowed
                             transition"
                >
                  {finalizing
                    ? "Finalizando avaliação..."
                    : "Finalizar avaliação da CPPD"}
                </button>
              </div>
            )}
          </div>

          {/* Coluna direita: comprovante grande fixo na tela (sticky) ocupando metade da página */}
          <div className="w-full md:w-1/2 md:sticky md:top-4 self-start">
            <div
              className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                          rounded-2xl p-4 shadow-sm min-h-[400px] md:min-h-[500px]
                          flex flex-col"
            >
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                Comprovante anexado
              </h2>

              {!activeItemId && (
                <p className="text-xs text-[var(--text-secondary)]">
                  Selecione um item preenchido pelo docente para visualizar o
                  comprovante correspondente.
                </p>
              )}

              {activeItemId && !currentEvidence && (
                <p className="text-xs text-[var(--text-secondary)]">
                  O item selecionado não possui comprovante anexado.
                </p>
              )}

              {activeItemId && currentEvidence && previewUrl && (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text-primary)] truncate">
                        {currentEvidence.originalName}
                      </p>
                      {currentEvidence.sizeBytes && (
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          Tamanho: {currentEvidence.sizeBytes} bytes
                        </p>
                      )}
                    </div>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-medium
                                 text-[var(--link-primary)]
                                 hover:underline"
                    >
                      Abrir em nova aba
                    </a>
                  </div>

                  <div className="mt-2 border border-[var(--border-subtle)] rounded-xl overflow-hidden h-[60vh] md:h-[70vh]">
                    <iframe
                      src={previewUrl}
                      className="w-full h-full bg-[var(--surface-muted)]"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
