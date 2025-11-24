"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Modal from "@/components/Modal"

type ProcessType = "PROGRESSAO" | "PROMOCAO"

type ApiResponse<T> = {
  status: string
  message: string
  data: T | null
}

type CreatedProcess = {
  processId: number
}

type ModalVariant = "success" | "error" | "info"

type ModalState = {
  open: boolean
  title: string
  message: string
  variant: ModalVariant
}

// tipos mínimos pro /me
type MeDocenteProfile = {
  classLevel?: string
  startInterstice?: string
  assignment?: string | null
}

type MeUser = {
  city?: string | null
  uf?: string | null
  docenteProfile?: MeDocenteProfile | null
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function toISODate(value?: string | Date | null): string {
  if (!value) return todayISO()
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return todayISO()
  return d.toISOString().slice(0, 10)
}

// chuta destino com base nas regras de negócio
function guessDestino(tipo: ProcessType, origemCodigo: string) {
  const code = origemCodigo.toUpperCase()

  if (tipo === "PROGRESSAO") {
    if (code === "A1") return { classe: "B", nivel: "1" } // A1 -> B1
    if (code === "B4") return { classe: "C", nivel: "1" } // B4 -> C1
    if (code === "C4") return { classe: "D", nivel: "1" } // C4 -> D1
    return null
  }

  // PROMOCAO
  if (code === "B1") return { classe: "B", nivel: "2" }
  if (code === "B2") return { classe: "B", nivel: "3" }
  if (code === "B3") return { classe: "B", nivel: "4" }
  if (code === "C1") return { classe: "C", nivel: "2" }
  if (code === "C2") return { classe: "C", nivel: "3" }
  if (code === "C3") return { classe: "C", nivel: "4" }
  return null
}

export default function Form() {
  const router = useRouter()

  const [tipo, setTipo] = useState<ProcessType>("PROGRESSAO")
  const [campus, setCampus] = useState("Santa Rosa")
  const [cidade, setCidade] = useState("Santa Rosa")
  const [estado, setEstado] = useState("RS")
  const [intersticioInicio, setIntersticioInicio] = useState(todayISO())
  const [intersticioFim, setIntersticioFim] = useState("")
  const [classeOrigem, setClasseOrigem] = useState("A")
  const [nivelOrigem, setNivelOrigem] = useState("1")
  const [classeDestino, setClasseDestino] = useState("B")
  const [nivelDestino, setNivelDestino] = useState("1")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  })

  const cidadeUF = useMemo(
    () => `${cidade} - ${estado}`,
    [cidade, estado]
  )

  function openModal(payload: Omit<ModalState, "open">) {
    setModal({
      open: true,
      ...payload
    })
  }

  function closeModal() {
    setModal(prev => ({
      ...prev,
      open: false
    }))
  }

  // 🔥 NOVO: buscar dados do usuário pra pré-preencher o formulário
  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      try {
        const r = await fetch("/api/me", {
          method: "GET",
          credentials: "include"
        })

        if (!r.ok) return

        const json = (await r.json().catch(() => null)) as ApiResponse<MeUser>
        const user = json?.data
        if (!user || cancelled) return

        // cidade / UF
        if (user.city) {
          setCidade(user.city)
        }
        if (user.uf) {
          setEstado(user.uf)
        }

        const docente = user.docenteProfile
        if (docente) {
          // campus a partir da lotação do docente
          if (docente.assignment) {
            setCampus(docente.assignment)
          }

          // início do interstício
          if (docente.startInterstice) {
            setIntersticioInicio(toISODate(docente.startInterstice))
          }

          // classe/nivel origem a partir do enum ClassLevel (ex.: "B4")
          if (docente.classLevel) {
            const code = docente.classLevel.toUpperCase()
            const classe = code.charAt(0)
            const nivel = code.slice(1)

            if (classe && nivel) {
              setClasseOrigem(classe)
              setNivelOrigem(nivel)

              const destino = guessDestino(tipo, code)
              if (destino) {
                setClasseDestino(destino.classe)
                setNivelDestino(destino.nivel)
              }
            }
          }
        }
      } catch {
        // se der erro aqui, só não pré-preenche, não quebra o form
      }
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [tipo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        patchUsuario: null,
        processo: {
          tipo,
          campus,
          cidadeUF,
          dataEmissaoISO: new Date().toISOString(),
          intersticioInicioISO: intersticioInicio,
          intersticioFimISO: intersticioFim,
          classeOrigem,
          nivelOrigem,
          classeDestino,
          nivelDestino
        }
      }

      const r = await fetch("/api/processos/abrir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(payload)
      })

      const json = (await r.json().catch(() => null)) as ApiResponse<CreatedProcess>

      if (!r.ok) {
        setError(json?.message || "Erro ao abrir processo")
        return
      }

      const processId = (json?.data as any)?.processId

      if (processId) {
        openModal({
          title: "Processo aberto",
          message: `Processo nº ${processId} aberto com sucesso. Você poderá gerar o requerimento quando completar o interstício.`,
          variant: "success"
        })

        setTimeout(() => {
          router.push(`/docente/processos/${processId}`)
        }, 600)
      } else {
        openModal({
          title: "Processo aberto",
          message: "Processo aberto com sucesso.",
          variant: "success"
        })
        setTimeout(() => {
          router.push("/docente/processos")
        }, 600)
      }
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao abrir o processo.",
        variant: "error"
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={closeModal}
      />

      <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-sm p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Abrir novo processo
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Informe os dados do interstício e da movimentação desejada para iniciar o processo.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--state-danger-bg)] text-[var(--state-danger-text)] text-sm p-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo e campus */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                Tipo de processo
              </label>
              <select
                className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                           bg-[var(--input-bg)] text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--input-border-focus)]"
                value={tipo}
                onChange={e => setTipo(e.target.value as ProcessType)}
              >
                <option value="PROGRESSAO">Progressão</option>
                <option value="PROMOCAO">Promoção</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                Campus
              </label>
              <input
                className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                           bg-[var(--input-bg)] text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--input-border-focus)]"
                value={campus}
                onChange={e => setCampus(e.target.value)}
              />
            </div>
          </div>

          {/* Cidade / UF */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                Cidade
              </label>
              <input
                className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                           bg-[var(--input-bg)] text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--input-border-focus)]"
                value={cidade}
                onChange={e => setCidade(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                UF
              </label>
              <input
                className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                           bg-[var(--input-bg)] text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--input-border-focus)]"
                value={estado}
                maxLength={2}
                onChange={e => setEstado(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          {/* Interstício */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                Início do interstício
              </label>
              <input
                type="date"
                className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                           bg-[var(--input-bg)] text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--input-border-focus)]"
                value={intersticioInicio}
                onChange={e => setIntersticioInicio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                Fim do interstício
              </label>
              <input
                type="date"
                className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                           bg-[var(--input-bg)] text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--input-border-focus)]"
                value={intersticioFim}
                onChange={e => setIntersticioFim(e.target.value)}
              />
            </div>
          </div>

          {/* Movimentação */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Origem
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 text-sm">
                  <label className="text-[var(--text-secondary)]">Classe</label>
                  <input
                    className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                               bg-[var(--input-bg)] text-[var(--text-primary)]
                               focus:outline-none focus:border-[var(--input-border-focus)]"
                    value={classeOrigem}
                    onChange={e => setClasseOrigem(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <label className="text-[var(--text-secondary)]">Nível</label>
                  <input
                    className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                               bg-[var(--input-bg)] text-[var(--text-primary)]
                               focus:outline-none focus:border-[var(--input-border-focus)]"
                    value={nivelOrigem}
                    onChange={e => setNivelOrigem(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Destino
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 text-sm">
                  <label className="text-[var(--text-secondary)]">Classe</label>
                  <input
                    className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                               bg-[var(--input-bg)] text-[var(--text-primary)]
                               focus:outline-none focus:border-[var(--input-border-focus)]"
                    value={classeDestino}
                    onChange={e => setClasseDestino(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <label className="text-[var(--text-secondary)]">Nível</label>
                  <input
                    className="border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm
                               bg-[var(--input-bg)] text-[var(--text-primary)]
                               focus:outline-none focus:border-[var(--input-border-focus)]"
                    value={nivelDestino}
                    onChange={e => setNivelDestino(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-full text-sm font-medium
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)]
                         disabled:opacity-50 transition"
            >
              {submitting ? "Abrindo processo..." : "Abrir processo"}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
