"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

export default function SelectRolePage() {
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("roles")
      const parsed = raw ? JSON.parse(raw) : []
      const valid = Array.isArray(parsed)
        ? parsed.filter((r: string) => ["DOCENTE", "CPPD_MEMBER", "ADMIN"].includes(r))
        : []
      if (!valid.length) {
        router.replace("/login")
        return
      }
      setRoles(valid as Role[])
    } catch {
      router.replace("/login")
    }
  }, [router])

  const label = useMemo(() => ({
    DOCENTE: "Docente",
    CPPD_MEMBER: "Membro Da CPPD",
    ADMIN: "Admin"
  } as Record<Role, string>), [])

  async function select(role: Role) {
    setLoading(true)
    setError(null)
    const r = await fetch("/api/auth/select-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role })
    })
    const json = await r.json()
    setLoading(false)

    if (!r.ok) {
      setError(json?.message ?? "Não foi possível selecionar o papel")
      return
    }

    if (role === "DOCENTE") {
      router.replace("/docente")
    } else if (role === "CPPD_MEMBER") {
      router.replace("/cppd")
    } else {
      router.replace("/dashboard")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-semibold mb-4">Escolha o módulo</h1>
        <p className="text-sm text-gray-600 mb-4">Selecione com qual papel você quer entrar agora.</p>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="grid gap-3">
          {roles.map((r) => (
            <button
              key={r}
              disabled={loading}
              onClick={() => select(r)}
              className="rounded-xl border px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50"
            >
              <div className="font-medium">{label[r]}</div>
              {/* <div className="text-xs text-gray-500">{r}</div> */}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
