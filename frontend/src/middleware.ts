import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=")
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function requiredRoleForPath(pathname: string): Role | null {
  if (pathname.startsWith("/professor")) return "DOCENTE"
  if (pathname.startsWith("/cppd")) return "CPPD_MEMBER"
  return null
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 🔓 libera rotas públicas
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register-professor") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next()
  }

  const access = req.cookies.get("accessToken")?.value

  // 🚫 se não tiver login, redireciona sempre para /login
  if (!access) {
    // inclui /forbidden aqui também — não abre sem login
    const url = new URL("/login", req.url)
    return NextResponse.redirect(url)
  }

  // 🔒 se tentar acessar /forbidden sem estar autenticado, bloqueia
  if (pathname.startsWith("/forbidden") && !access) {
    const url = new URL("/login", req.url)
    return NextResponse.redirect(url)
  }

  // 🔐 verifica roles quando necessário
  const must = requiredRoleForPath(pathname)
  if (must) {
    const payload = decodeJwtPayload(access)
    const roles: string[] = Array.isArray(payload?.roles) ? payload.roles : []
    const hasRole = roles.includes(must)

    if (!hasRole) {
      const url = new URL("/forbidden", req.url)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

// 🧭 Define rotas protegidas
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/professor/:path*",
    "/cppd/:path*",
    "/forbidden/:path*" // adiciona pra validar o acesso à forbidden também
  ]
}
