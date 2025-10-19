"use client"

import { useState } from "react"

export function LogoutButton() {
  const [loading, setLoading] = useState(false) // false tanto no server quanto no client

  async function onClick() {
    try {
      setLoading(true)
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      })
      sessionStorage.clear()
      window.location.href = "/login"
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="px-3 py-2 bg-black text-white rounded-xl hover:opacity-80 disabled:opacity-60"
      title="Sair"
    >
      {loading ? "Saindo..." : "Sair"}
    </button>
  )
}
