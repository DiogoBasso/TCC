import { cookies } from "next/headers"
import RoleSwitcherClient from "./RoleSwitcherClient"

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

export default async function RoleSwitcherServer() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) return null

  const payload = decodeJwtPayloadServer(access)
  const roles: Role[] = Array.isArray(payload?.roles) ? payload.roles : []
  const selectedRole: Role | null = payload?.selectedRole ?? null

  // só renderiza se houver pelo menos duas roles no conjunto {DOCENTE, CPPD_MEMBER}
  const countDocenteCppd = roles.filter(r => r === "DOCENTE" || r === "CPPD_MEMBER").length
  if (countDocenteCppd < 2) return null

  return <RoleSwitcherClient roles={roles} selectedRole={selectedRole} />
}
