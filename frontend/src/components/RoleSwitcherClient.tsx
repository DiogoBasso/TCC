"use client"

import { useMemo, useState } from "react"
import RoleDropdown from "@/components/ui/RoleDropdown"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

function pathForRole(role: Role | null | undefined) {
  if (role === "DOCENTE") return "/professor"
  if (role === "CPPD_MEMBER") return "/cppd"
  if (role === "ADMIN") return "/dashboard"
  return "/dashboard"
}

const ROLE_LABEL: Record<Role, string> = {
  DOCENTE: "Docente",
  CPPD_MEMBER: "CPPD",
  ADMIN: "Admin"
}

export default function RoleSwitcherClient(props: { roles: Role[]; selectedRole: Role | null }) {
  const { roles, selectedRole } = props
  const [value, setValue] = useState<Role | "">((selectedRole ?? "") as any)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Apenas DOCENTE e CPPD (ignora ADMIN para o switch)
  const options = useMemo(() => {
    const filtered = roles.filter((r): r is Exclude<Role, "ADMIN"> => r === "DOCENTE" || r === "CPPD_MEMBER")
    const unique = Array.from(new Set(filtered)) as Role[]
    return unique.map(r => ({ value: r, label: ROLE_LABEL[r] }))
  }, [roles])

  // Exibe só se houver pelo menos duas opções (Docente e CPPD)
  if (options.length < 2) return null

  async function switchTo(nextRole: Role) {
    if (nextRole === selectedRole) return
    setError(null)
    setLoading(true)
    try {
      const r = await fetch("/api/auth/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: nextRole }),
        cache: "no-store"
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        setError(err?.message ?? "Não foi possível alternar o papel agora.")
        setValue((selectedRole ?? "") as any)
        return
      }
      window.location.href = pathForRole(nextRole)
    } catch (e: any) {
      setError("Falha de conexão ao alternar papel.")
      setValue((selectedRole ?? "") as any)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col">
      <div className="inline-flex items-center gap-2">
        <label htmlFor="role-switcher" className="text-sm text-gray-600">
          Módulo:
        </label>

        <RoleDropdown
          id="role-switcher"
          value={(value as string) || null}
          options={options}
          disabled={loading}
          onChange={(val) => {
            setValue(val as Role)
            switchTo(val as Role)
          }}
        />
      </div>

      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </div>
  )
}
