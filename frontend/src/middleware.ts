import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const access = req.cookies.get("accessToken")?.value
  if (!access) {
    const url = new URL("/login", req.url)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/professor/:path*", "/cppd/:path*"]
}
