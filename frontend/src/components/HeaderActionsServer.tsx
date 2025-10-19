import { cookies } from "next/headers"
import HeaderActionsClient from "./HeaderActionsClient"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

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

export default async function HeaderActionsServer() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) return null

  const payload = decodeJwtPayloadServer(access)
  const roles: Role[] = Array.isArray(payload?.roles) ? payload.roles : []
  const selectedRole: Role | null = payload?.selectedRole ?? null

  // Renderiza o client com snapshot estável — isso evita diferenças de estrutura na hidratação
  return <HeaderActionsClient roles={roles} selectedRole={selectedRole} />
}
