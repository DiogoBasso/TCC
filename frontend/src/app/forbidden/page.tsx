import { cookies } from "next/headers"
import { LogoutButton } from "@/components/LogoutButton"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

function mapRoleToPath(role: Role | null | undefined) {
  if (role === "DOCENTE") return "/professor"
  if (role === "CPPD_MEMBER") return "/cppd"
  if (role === "ADMIN") return "/dashboard"
  return "/dashboard"
}

function decodeJwtPayloadServer(token: string): any | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const json = Buffer.from(parts[1], "base64url").toString("utf8")
    return JSON.parse(json)
  } catch {
    return null
  }
}

export default async function ForbiddenPage() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value ?? ""

  // destino padrão
  let backPath = "/dashboard"

  if (access) {
    const payload = decodeJwtPayloadServer(access)
    const selected: Role | null | undefined = payload?.selectedRole ?? null
    const roles: Role[] = Array.isArray(payload?.roles) ? payload.roles : []

    if (selected) {
      backPath = mapRoleToPath(selected)
    } else if (roles.length) {
      // prioridade por presença de role
      if (roles.includes("DOCENTE")) backPath = "/professor"
      else if (roles.includes("CPPD_MEMBER")) backPath = "/cppd"
      else if (roles.includes("ADMIN")) backPath = "/dashboard"
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold mb-2">Acesso negado</h1>
        <p className="text-gray-600 mb-6">
          Você não tem permissão para acessar esta página.
        </p>

        <div className="flex gap-3 justify-center">
          {/* Voltar conforme role do usuário */}
          <a
            href={backPath}
            className="px-4 py-2 rounded-xl border"
          >
            Voltar
          </a>

          {/* Trocar usuário = logout da sessão atual */}
          <LogoutButton />
        </div>
      </div>
    </main>
  )
}
