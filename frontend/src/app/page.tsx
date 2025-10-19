// src/app/page.tsx
import Link from "next/link"

export default function Home() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Bem-vindo</h1>
      <div className="flex gap-3">
        <Link href="/login" className="px-4 py-2 rounded-xl border">
          Entrar
        </Link>
        <Link href="/register-professor" className="px-4 py-2 rounded-xl bg-black text-white">
          Cadastrar Professor
        </Link>
      </div>
    </main>
  )
}
