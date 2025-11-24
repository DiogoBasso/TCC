"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Modal from "@/components/Modal"
import ConfirmModal from "@/components/ConfirmModal"

type ProcessType = "PROGRESSAO" | "PROMOCAO"

type ProcessStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED"

type Processo = {
  processId: number
  type: ProcessType
  status: ProcessStatus
  scoringTableId: number
  createdAt: string
  userId: number
  campus: string
  cidadeUF: string
  intersticeStart: string
  intersticeEnd: string
  classeOrigem: string
  nivelOrigem: string
  classeDestino: string
  nivelDestino: string
}

type ApiResponse<T> = {
  status: string
  message: string
  data: T | null
}

type ModalVariant = "success" | "error" | "info"

type ModalState = {
  open: boolean
  title: string
  message: string
  variant: ModalVariant
}

// ----- HELPERS DE DATA (SEM new Date) ---------------------------------------

function normalizeYMD(value: string | null | undefined) {
  if (!value) return ""

  const s = value.toString()
  const base = s.length >= 10 ? s.slice(0, 10) : s

  const [year, month, day] = base.split("-")
  if (!year || !month || !day) return ""

  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(
    2,
    "0"
  )}`
}

function toISODateInput(value: string | null | undefined) {
  return normalizeYMD(value)
}

function formatDate(value: string | null | undefined) {
  const ymd = normalizeYMD(value)
  if (!ymd) return ""
  const [year, month, day] = ymd.split("-")
  return `${day}/${month}/${year}`
}

// ----- OUTROS HELPERS -------------------------------------------------------

function statusLabel(status: ProcessStatus) {
  switch (status) {
    case "DRAFT":
      return "Rascunho"
    case "SUBMITTED":
      return "Submetido"
    case "UNDER_REVIEW":
      return "Em análise"
    case "RETURNED":
      return "Devolvido"
    case "APPROVED":
      return "Aprovado"
    case "REJECTED":
      return "Indeferido"
    default:
      return status
  }
}

function badgeColor(status: ProcessStatus) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800"
  if (status === "REJECTED") return "bg-red-100 text-red-800"
  if (status === "RETURNED") return "bg-amber-100 text-amber-800"
  if (status === "UNDER_REVIEW") return "bg-blue-100 text-blue-800"
  if (status === "SUBMITTED") return "bg-slate-100 text-slate-800"
  return "bg-gray-100 text-gray-700"
}

// ----- COMPONENTE -----------------------------------------------------------

export default function ProcessoDetalhePage() {
  const params = useParams()
  const id = (params as any)?.id as string | undefined

  const [processo, setProcesso] = useState<Processo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [formCampus, setFormCampus] = useState("")
  const [formCidadeUF, setFormCidadeUF] = useState("")
  const [formIntersticioInicio, setFormIntersticioInicio] = useState("")
  const [formIntersticioFim, setFormIntersticioFim] = useState("")
  const [formClasseOrigem, setFormClasseOrigem] = useState("")
  const [formNivelOrigem, setFormNivelOrigem] = useState("")
  const [formClasseDestino, setFormClasseDestino] = useState("")
  const [formNivelDestino, setFormNivelDestino] = useState("")

  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  })

  // modal específico para confirmar exclusão
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const isEditable =
    !!processo &&
    (processo.status === "DRAFT" ||
      processo.status === "RETURNED" ||
      processo.status === "REJECTED")

  const canDelete =
    !!processo &&
    (processo.status === "DRAFT" || processo.status === "REJECTED")

  // pode iniciar preenchimento de pontuação?
  const canFillScores = isEditable

  useEffect(() => {
    async function load() {
      if (!id) return
      setLoading(true)
      setError(null)

      try {
        const r = await fetch(`/api/processos/${id}`, {
          method: "GET",
          credentials: "include"
        })

        const json = (await r.json().catch(() => null)) as ApiResponse<Processo>

        if (!r.ok) {
          setError(json?.message || "Erro ao carregar processo")
          setProcesso(null)
          return
        }

        if (!json?.data) {
          setError("Processo não encontrado")
          setProcesso(null)
          return
        }

        setProcesso(json.data)
        resetFormFromProcess(json.data)
      } catch (e: any) {
        setError(e?.message || "Erro inesperado ao carregar processo")
        setProcesso(null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  function openModal(payload: Omit<ModalState, "open">) {
    setModal({
      open: true,
      ...payload
    })
  }

  function closeModal() {
    setModal(prev => ({ ...prev, open: false }))
  }

  function resetFormFromProcess(p: Processo | null) {
    if (!p) return
    setFormCampus(p.campus ?? "")
    setFormCidadeUF(p.cidadeUF ?? "")
    setFormIntersticioInicio(toISODateInput(p.intersticeStart))
    setFormIntersticioFim(toISODateInput(p.intersticeEnd))
    setFormClasseOrigem(p.classeOrigem ?? "")
    setFormNivelOrigem(p.nivelOrigem ?? "")
    setFormClasseDestino(p.classeDestino ?? "")
    setFormNivelDestino(p.nivelDestino ?? "")
  }

  async function handleGerarRequerimento() {
    if (!id) return
    setDownloading(true)
    setError(null)

    try {
      const r = await fetch(`/api/processos/requerimento/${id}`, {
        method: "POST",
        credentials: "include"
      })

      if (!r.ok) {
        const json = await r.json().catch(() => null as any)
        const message =
          json?.message ||
          "Erro ao gerar requerimento. Verifique as regras do processo."
        openModal({
          title: "Erro ao gerar requerimento",
          message,
          variant: "error"
        })
        return
      }

      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")

      const suggested =
        (r.headers.get("Content-Disposition") ||
          r.headers.get("content-disposition") ||
          "") ?? ""

      let filename = `requerimento-processo-${id}.pdf`
      const match = suggested.match(/filename="?([^"]+)"?/i)
      if (match && match[1]) filename = match[1]

      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao gerar o requerimento.",
        variant: "error"
      })
    } finally {
      setDownloading(false)
    }
  }

  async function handleSaveEdit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!id || !processo) return

    setSaving(true)
    setError(null)

    try {
      const processoPayload: any = {}

      if (formCampus !== processo.campus) {
        processoPayload.campus = formCampus
      }

      if (formCidadeUF !== processo.cidadeUF) {
        processoPayload.cidadeUF = formCidadeUF
      }

      const originalInicio = toISODateInput(processo.intersticeStart)
      const originalFim = toISODateInput(processo.intersticeEnd)

      if (formIntersticioInicio && formIntersticioInicio !== originalInicio) {
        processoPayload.intersticioInicioISO = formIntersticioInicio
      }

      if (formIntersticioFim && formIntersticioFim !== originalFim) {
        processoPayload.intersticioFimISO = formIntersticioFim
      }

      if (formClasseOrigem && formClasseOrigem !== processo.classeOrigem) {
        processoPayload.classeOrigem = formClasseOrigem
      }

      if (formNivelOrigem && formNivelOrigem !== processo.nivelOrigem) {
        processoPayload.nivelOrigem = formNivelOrigem
      }

      if (formClasseDestino && formClasseDestino !== processo.classeDestino) {
        processoPayload.classeDestino = formClasseDestino
      }

      if (formNivelDestino && formNivelDestino !== processo.nivelDestino) {
        processoPayload.nivelDestino = formNivelDestino
      }

      const hasChanges = Object.keys(processoPayload).length > 0

      if (!hasChanges) {
        setEditMode(false)
        return
      }

      const payload = {
        processo: processoPayload
      }

      const r = await fetch(`/api/processos/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(payload)
      })

      const json = (await r.json().catch(() => null)) as ApiResponse<Processo>

      if (!r.ok) {
        const message = json?.message || "Erro ao salvar alterações."
        openModal({
          title: "Erro ao salvar",
          message,
          variant: "error"
        })
        return
      }

      if (!json?.data) {
        openModal({
          title: "Erro",
          message: "Resposta inválida do servidor ao salvar processo.",
          variant: "error"
        })
        return
      }

      setProcesso(json.data)
      resetFormFromProcess(json.data)
      setEditMode(false)
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao salvar as alterações.",
        variant: "error"
      })
    } finally {
      setSaving(false)
    }
  }

  function handleDeleteClick() {
    if (!processo) return
    if (!canDelete) return

    setConfirmDeleteOpen(true)
  }

  async function handleDeleteConfirmed() {
    if (!id || !processo) return
    if (!canDelete) return

    setConfirmDeleteOpen(false)
    setDeleting(true)
    setError(null)

    try {
      const r = await fetch(`/api/processos/${id}`, {
        method: "DELETE",
        credentials: "include"
      })

      const json = (await r.json().catch(() => null)) as ApiResponse<any>

      if (!r.ok) {
        const message = json?.message || "Erro ao excluir processo."
        openModal({
          title: "Erro ao excluir",
          message,
          variant: "error"
        })
        return
      }

      openModal({
        title: "Processo excluído",
        message: "Processo excluído com sucesso.",
        variant: "success"
      })

      setTimeout(() => {
        window.location.href = "/docente/processos"
      }, 600)
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao excluir o processo.",
        variant: "error"
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="min-h-[60vh]">
      {/* Modal de mensagem */}
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={closeModal}
      />

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Confirmar exclusão"
        message={
          processo
            ? `Tem certeza que deseja excluir o processo nº ${processo.processId}?`
            : "Tem certeza que deseja excluir este processo?"
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Detalhes do Processo {id ? `#${id}` : ""}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Visualize as informações, edite dados permitidos, preencha a pontuação e
              gere o requerimento em PDF.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/docente/processos"
              className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                         text-sm text-[var(--btn-secondary-text)]
                         hover:bg-[var(--btn-secondary-hover-bg)] transition"
            >
              Voltar para lista
            </Link>
          </div>
        </header>

        {loading && (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-[var(--text-secondary)]">
              Carregando processo...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--state-danger-bg)] p-4 text-sm text-[var(--state-danger-text)]">
            {error}
          </div>
        )}

        {!loading && !error && !processo && (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-[var(--text-secondary)]">
              Processo não encontrado.
            </p>
          </div>
        )}

        {!loading && !error && processo && (
          <div className="space-y-6">
            {/* Bloco geral */}
            <section className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Informações gerais
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                      badgeColor(processo.status)
                    }
                  >
                    {statusLabel(processo.status)}
                  </span>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!editMode) resetFormFromProcess(processo)
                        setEditMode(true)
                      }}
                      className="px-3 py-1.5 rounded-full border border-[var(--btn-secondary-border)]
             text-xs text-[var(--btn-secondary-text)]
             hover:bg-[var(--btn-secondary-hover-bg)] transition"
                    >
                      Editar dados
                    </button>
                  )}
                </div>
              </div>

              {!editMode && (
                <div className="text-sm space-y-1 text-[var(--text-secondary)]">
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Número:
                    </span>{" "}
                    {processo.processId}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Tipo:
                    </span>{" "}
                    {processo.type === "PROGRESSAO" ? "Progressão" : "Promoção"}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Situação:
                    </span>{" "}
                    {statusLabel(processo.status)}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Campus:
                    </span>{" "}
                    {processo.campus}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Cidade/UF:
                    </span>{" "}
                    {processo.cidadeUF}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Interstício:
                    </span>{" "}
                    {formatDate(processo.intersticeStart)}{" "}
                    <span className="text-[var(--text-muted)]">→</span>{" "}
                    {formatDate(processo.intersticeEnd)}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Origem:
                    </span>{" "}
                    {processo.classeOrigem}
                    {processo.nivelOrigem}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Destino:
                    </span>{" "}
                    {processo.classeDestino}
                    {processo.nivelDestino}
                  </div>
                </div>
              )}

              {editMode && (
                <form
                  onSubmit={handleSaveEdit}
                  className="space-y-4 mt-3 border-t border-[var(--border-subtle)] pt-4"
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">Campus</label>
                      <input
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   placeholder:text-[var(--input-placeholder)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formCampus}
                        onChange={e => setFormCampus(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">Cidade/UF</label>
                      <input
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   placeholder:text-[var(--input-placeholder)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formCidadeUF}
                        onChange={e => setFormCidadeUF(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">
                        Início do interstício
                      </label>
                      <input
                        type="date"
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formIntersticioInicio}
                        onChange={e => setFormIntersticioInicio(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">
                        Fim do interstício
                      </label>
                      <input
                        type="date"
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formIntersticioFim}
                        onChange={e => setFormIntersticioFim(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">
                        Classe de origem
                      </label>
                      <input
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formClasseOrigem}
                        onChange={e =>
                          setFormClasseOrigem(e.target.value.toUpperCase())
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">
                        Nível de origem
                      </label>
                      <input
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formNivelOrigem}
                        onChange={e => setFormNivelOrigem(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">
                        Classe de destino
                      </label>
                      <input
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formClasseDestino}
                        onChange={e =>
                          setFormClasseDestino(e.target.value.toUpperCase())
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">
                        Nível de destino
                      </label>
                      <input
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formNivelDestino}
                        onChange={e => setFormNivelDestino(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false)
                        resetFormFromProcess(processo)
                      }}
                      className="px-3 py-1.5 rounded-full border border-[var(--btn-secondary-border)]
                                 text-xs text-[var(--btn-secondary-text)]
                                 hover:bg-[var(--btn-secondary-hover-bg)] transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-3 py-1.5 rounded-full text-xs font-medium
                                 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                 hover:bg-[var(--btn-primary-hover-bg)]
                                 disabled:opacity-50 transition"
                    >
                      {saving ? "Salvando..." : "Salvar alterações"}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Ações (pontuação / PDF / excluir) */}
            <section className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Ações
              </h2>
              <div className="flex flex-wrap gap-3">
                {canFillScores && id && (
                  <Link
                    href={`/docente/processos/${id}/pontuacao`}
                    className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition"
                  >
                    Preencher pontuação
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleGerarRequerimento}
                  disabled={downloading}
                  className="px-4 py-2 rounded-full text-sm
                             bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                             hover:bg-[var(--btn-primary-hover-bg)]
                             disabled:opacity-50 transition"
                >
                  {downloading ? "Gerando PDF..." : "Gerar requerimento"}
                </button>

                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="px-4 py-2 rounded-full border border-red-300 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    {deleting ? "Excluindo..." : "Excluir processo"}
                  </button>
                )}
              </div>

              {!canFillScores && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  O preenchimento da pontuação só é permitido para processos nos status{" "}
                  <span className="font-medium">DRAFT</span>,{" "}
                  <span className="font-medium">RETURNED</span> ou{" "}
                  <span className="font-medium">REJECTED</span>.
                </p>
              )}

              {!canDelete && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  A exclusão só é permitida para processos nos status{" "}
                  <span className="font-medium">DRAFT</span> ou{" "}
                  <span className="font-medium">REJECTED</span>.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
