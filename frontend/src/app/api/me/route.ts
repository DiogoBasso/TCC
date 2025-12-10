// src/app/api/me/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const ME_PATH = "/me"

export async function GET() {
  if (!backend) {
    return NextResponse.json(
      { message: "BACKEND_URL não configurada" },
      { status: 500 }
    )
  }

  const cookieStore = await cookies()
  const access = cookieStore.get("accessToken")?.value

  if (!access) {
    return NextResponse.json(
      { message: "Não autenticado" },
      { status: 401 }
    )
  }

  try {
    const r = await fetch(`${backend}${ME_PATH}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access}`
      }
    })

    const text = await r.text().catch(() => "")
    let json: any = null

    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }

    return NextResponse.json(json, { status: r.status })
  } catch (e: any) {
    return NextResponse.json(
      {
        message: "Erro ao conectar com o servidor",
        error: e?.message ?? "unknown"
      },
      { status: 502 }
    )
  }
}
