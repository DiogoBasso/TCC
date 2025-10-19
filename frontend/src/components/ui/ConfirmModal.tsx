"use client"

import { useEffect, useRef } from "react"

type Props = {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  loading = false,
  onConfirm,
  onCancel
}: Props) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  // Foco no botão cancelar ao abrir (acessibilidade)
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => cancelRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open])

  // Fechar com ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl p-6">
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-gray-600 mt-2">{description}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="px-4 py-2 rounded-xl border hover:bg-gray-50"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-60"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Confirmando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
