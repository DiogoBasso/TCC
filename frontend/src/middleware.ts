import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(
      base64.length + (4 - (base64.length % 4)) % 4,
      "="
    )
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function redirectToLogin(req: NextRequest, reason: string) {
  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("reason", reason)
  return NextResponse.redirect(url)
}

function redirectToForbidden(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = "/forbidden"
  url.searchParams.delete("reason")
  return NextResponse.redirect(url)
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // só intercepta as rotas que nos interessam (definidas no config.matcher)
  const accessToken = req.cookies.get("accessToken")?.value

  if (!accessToken) {
    return redirectToLogin(req, "no_token")
  }

  const payload = decodeJwtPayload(accessToken)
  if (!payload) {
    return redirectToLogin(req, "invalid_token")
  }

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === "number" && payload.exp < now) {
    return redirectToLogin(req, "expired")
  }

  const roles: Role[] = Array.isArray(payload.roles) ? payload.roles : []
  const selectedRole: Role | null = payload.selectedRole ?? null

  const hasRole = (role: Role) => roles.includes(role)

  // regras de permissão por módulo
  if (pathname.startsWith("/docente")) {
    if (!hasRole("DOCENTE")) return redirectToForbidden(req)
    if (selectedRole && selectedRole !== "DOCENTE") {
      return redirectToForbidden(req)
    }
  }

  if (pathname.startsWith("/cppd")) {
    if (!hasRole("CPPD_MEMBER")) return redirectToForbidden(req)
    if (selectedRole && selectedRole !== "CPPD_MEMBER") {
      return redirectToForbidden(req)
    }
  }

  if (pathname.startsWith("/dashboard")) {
    if (!hasRole("ADMIN")) {
      return redirectToForbidden(req)
    }
  }

  // /forbidden só precisa de usuário logado (já checamos token)
  return NextResponse.next()
}

// 🧭 Rotas protegidas
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/docente/:path*",
    "/cppd/:path*",
    "/forbidden/:path*"
  ]
}
