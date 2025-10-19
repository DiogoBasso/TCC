// src/app/(auth)/login/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

function pathForRole(role: Role | null | undefined) {
  if (role === "DOCENTE") return "/professor"
  if (role === "CPPD_MEMBER") return "/cppd"
  if (role === "ADMIN") return "/dashboard"
  return "/dashboard"
}

export default function LoginPage() {
  const [cpf, setCpf] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ cpf, password })
    })

    const json = await r.json()
    setLoading(false)

    if (!r.ok) {
      setError(json?.message ?? "Falha no login")
      return
    }

    const data = json as {
      roles?: Role[]
      selectedRole?: Role | null
      needsProfileSelection?: boolean
    }

    if (data?.needsProfileSelection) {
      sessionStorage.setItem("roles", JSON.stringify(data.roles ?? []))
      sessionStorage.setItem("selectedRole", JSON.stringify(data.selectedRole ?? null))
      router.push("/select-role")
      return
    }

    if (data?.selectedRole) {
      router.push(pathForRole(data.selectedRole))
      return
    }

    if (Array.isArray(data?.roles) && data.roles!.length === 1) {
      router.push(pathForRole(data.roles![0]))
      return
    }

    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-semibold mb-4">Entrar</h1>

        <label className="block text-sm mb-1">CPF</label>
        <input
          className="w-full border rounded-xl p-2 mb-3 outline-none focus:ring"
          value={cpf}
          onChange={e => setCpf(e.target.value)}
          placeholder="000.000.000-00"
        />

        <label className="block text-sm mb-1">Senha</label>
        <input
          className="w-full border rounded-xl p-2 outline-none focus:ring"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-black text-white py-2 mt-4 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <div className="mt-4 text-center">
          <span className="text-sm text-gray-600">Não tem conta?</span>{" "}
          <a href="/register-professor" className="text-sm text-blue-600 hover:underline">
            Cadastre-se
          </a>
        </div>
      </form>
    </div>
  )
}
