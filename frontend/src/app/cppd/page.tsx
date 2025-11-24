import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import HeaderActionsServer from "@/components/HeaderActionsServer"

export default async function CppdPage() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) redirect("/login")

  return (
    <main
      className="
        min-h-screen
        p-6
        flex flex-col
        bg-[var(--surface-muted)]
      "
    >
      <header
        className="
          flex justify-between items-center
          mb-6 gap-4
        "
      >
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Módulo CPPD
        </h1>

        <HeaderActionsServer />
      </header>

      <section className="text-[var(--text-primary)]">
        <p className="mt-2">Bem-vindo!</p>
      </section>
    </main>
  )
}
