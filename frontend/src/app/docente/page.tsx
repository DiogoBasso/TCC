import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import HeaderActionsServer from "@/components/HeaderActionsServer"

export default async function ProfessorPage() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) redirect("/login")

  return (
    <main className="p-6 flex flex-col min-h-screen bg-gray-50">
      <header className="flex justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold">Módulo do Professor</h1>
        <HeaderActionsServer />
      </header>

      <section>
        <p className="mt-2">Bem-vindo!</p>
      </section>
    </main>
  )
}
