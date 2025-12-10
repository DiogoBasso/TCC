import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const backendBase = process.env.BACKEND_URL

async function getAccessToken() {
  const jar = await cookies()
  return jar.get("accessToken")?.value ?? null
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!backendBase) {
    return NextResponse.json(
      { status: "error", message: "BACKEND_URL não configurada", data: null },
      { status: 500 }
    )
  }

  const { id } = await context.params

  const token = await getAccessToken()
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "Não autenticado", data: null },
      { status: 401 }
    )
  }

  const body = await req.json()

  try {
    const backendRes = await fetch(
      // 🔗 Alinhado com o backend: POST /processes/:id/evaluation/finalize
      `${backendBase}/processes/${id}/evaluation/finalize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    )

    const contentType = backendRes.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      const backendBody = await backendRes.json()
      return NextResponse.json(backendBody, { status: backendRes.status })
    }

    const text = await backendRes.text()
    console.error(
      "Resposta NÃO-JSON do backend em POST /processes/:id/evaluation/finalize:",
      text.slice(0, 500)
    )

    return NextResponse.json(
      {
        status: "error",
        message:
          "Resposta inesperada do backend ao finalizar avaliação da CPPD.",
        data: null
      },
      { status: backendRes.status || 500 }
    )
  } catch (error) {
    console.error("Erro ao finalizar avaliação CPPD:", error)

    return NextResponse.json(
      {
        status: "error",
        message: "Erro ao finalizar avaliação CPPD.",
        data: null
      },
      { status: 500 }
    )
  }
}
