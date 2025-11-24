import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL
const ME_PATH = process.env.BACKEND_ME_PATH

function norm(x: any) {
  const u = x?.data ?? x ?? {}
  return {
    campus: u.campus?.name ?? u.campus ?? "",
    nome: u.name ?? u.nome ?? "",
    siape: u.siape ?? "",
    classeOrigem: u.classeOrigem ?? u.docenteProfile?.classeOrigem ?? "",
    nivelOrigem: u.nivelOrigem ?? u.docenteProfile?.nivelOrigem ?? "",
    intersticioInicio: u.intersticioInicio ?? u.docenteProfile?.intersticioInicio ?? "",
    cidade: u.cidade ?? u.address?.city ?? "",
    estado: u.estado ?? u.address?.state ?? "",
    email: u.email ?? "",
    celular: u.celular ?? u.phone ?? ""
  }
}

export async function GET() {
  if (!backend || !ME_PATH) return NextResponse.json({ message: "missing_backend_env" }, { status: 500 })
  const cookieStore = await cookies()
  const access = cookieStore.get("accessToken")?.value
  if (!access) return NextResponse.json({ message: "unauthorized" }, { status: 401 })
  const r = await fetch(`${backend}${ME_PATH}`, { headers: { Authorization: `Bearer ${access}` }, cache: "no-store" })
  if (!r.ok) return NextResponse.json({ message: "erro_usuarios_me", status: r.status, detail: await r.text().catch(()=>"") }, { status: r.status })
  const raw = await r.json()
  return NextResponse.json({ data: norm(raw) })
}
