"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type DocenteProfile = {
  siape: string
  class: string
  level: string
  startInterstice: string // yyyy-mm-dd (input date)
  educationLevel: string
  improvement?: string | null
  specialization?: string | null
  mastersDegree?: string | null
  doctorate?: string | null
  assignment?: string | null
  department?: string | null
  division?: string | null
  role?: string | null
  immediateSupervisor?: string | null
}

export default function RegisterProfessorPage() {
  const router = useRouter()

  // campos principais
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [password, setPassword] = useState("")

  // docente profile (obrigatórios)
  const [siape, setSiape] = useState("")
  const [klass, setKlass] = useState("") // "class" é palavra reservada, uso 'klass' no state
  const [level, setLevel] = useState("")
  const [startInterstice, setStartInterstice] = useState("")
  const [educationLevel, setEducationLevel] = useState("")

  // opcionais
  const [improvement, setImprovement] = useState<string | "">("")
  const [specialization, setSpecialization] = useState<string | "">("")
  const [mastersDegree, setMastersDegree] = useState<string | "">("")
  const [doctorate, setDoctorate] = useState<string | "">("")
  const [assignment, setAssignment] = useState<string | "">("")
  const [department, setDepartment] = useState<string | "">("")
  const [division, setDivision] = useState<string | "">("")
  const [role, setRole] = useState<string | "">("")
  const [immediateSupervisor, setImmediateSupervisor] = useState<string | "">("")

  // ui state
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validateCPF(v: string) {
    // validação superficial para evitar ruído no front; backend faz a validação real
    const digits = v.replace(/\D/g, "")
    return digits.length === 11
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // validações mínimas de front (o backend faz a validação real)
    if (!name || !email || !cpf || !password) {
      setError("Preencha nome, e-mail, CPF e senha")
      return
    }
    if (!validateCPF(cpf)) {
      setError("CPF inválido")
      return
    }
    if (!siape || !klass || !level || !startInterstice || !educationLevel) {
      setError("Preencha os campos obrigatórios do perfil docente")
      return
    }

    const payload = {
      name,
      email,
      cpf,
      password,
      docenteProfile: {
        siape,
        class: klass,
        level,
        startInterstice: new Date(startInterstice), // backend espera Date
        educationLevel,
        improvement: improvement || null,
        specialization: specialization || null,
        mastersDegree: mastersDegree || null,
        doctorate: doctorate || null,
        assignment: assignment || null,
        department: department || null,
        division: division || null,
        role: role || null,
        immediateSupervisor: immediateSupervisor || null
      }
      // roles é proibido nesta rota pública
    }

    setLoading(true)
    try {
      const r = await fetch("/api/public/register-professor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const json = await r.json().catch(() => ({}))

      if (!r.ok) {
        // tenta mostrar mensagem do backend se existir
        const msg =
          json?.message ||
          json?.error ||
          (Array.isArray(json?.data) ? json.data.join(", ") : null) ||
          "Falha ao cadastrar"
        setError(msg)
        setLoading(false)
        return
      }

      setSuccess("Cadastro realizado com sucesso! Redirecionando para login...")
      setLoading(false)
      // limpa os campos
      clearForm()
      // redireciona para login após 1.2s
      setTimeout(() => router.push("/login"), 1200)
    } catch (err: any) {
      setError("Erro de conexão. Tente novamente.")
      setLoading(false)
    }
  }

  function clearForm() {
    setName("")
    setEmail("")
    setCpf("")
    setPassword("")
    setSiape("")
    setKlass("")
    setLevel("")
    setStartInterstice("")
    setEducationLevel("")
    setImprovement("")
    setSpecialization("")
    setMastersDegree("")
    setDoctorate("")
    setAssignment("")
    setDepartment("")
    setDivision("")
    setRole("")
    setImmediateSupervisor("")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-3xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-semibold mb-4">Cadastro de Professor</h1>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {success && <p className="text-green-700 text-sm mb-3">{success}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dados pessoais */}
          <div className="md:col-span-2">
            <h2 className="text-lg font-medium mb-2">Dados pessoais</h2>
          </div>

          <div>
            <label className="block text-sm mb-1">Nome completo *</label>
            <input
              className="w-full border rounded-xl p-2 outline-none focus:ring"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">E-mail *</label>
            <input
              type="email"
              className="w-full border rounded-xl p-2 outline-none focus:ring"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">CPF *</label>
            <input
              className="w-full border rounded-xl p-2 outline-none focus:ring"
              value={cpf}
              onChange={e => setCpf(e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Senha *</label>
            <input
              type="password"
              className="w-full border rounded-xl p-2 outline-none focus:ring"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
            />
          </div>

          {/* Perfil Docente */}
          <div className="md:col-span-2 mt-4">
            <h2 className="text-lg font-medium mb-2">Perfil do Docente</h2>
          </div>

          <div>
            <label className="block text-sm mb-1">SIAPE *</label>
            <input
              className="w-full border rounded-xl p-2 outline-none focus:ring"
              value={siape}
              onChange={e => setSiape(e.target.value)}
              placeholder="SIAPE"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Classe *</label>
            <input
              className="w-full border rounded-xl p-2 outline-none focus:ring"
              value={klass}
              onChange={e => setKlass(e.target.value)}
              placeholder="Classe"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Nível *</label>
            <input
              className="w-full border rounded-xl p-2 outline-none focus:ring"
              value={level}
              onChange={e => setLevel(e.target.value)}
              placeholder="Nível"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Início do Interstício *</label>
            <input
              type="date"
              className="w-full border rounded-xl p-2 outline-none focus:ring"
              value={startInterstice}
              onChange={e => setStartInterstice(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Escolaridade *</label>
            <input
              className="w-full border rounded-xl p-2 outline-none focus:ring"
              value={educationLevel}
              onChange={e => setEducationLevel(e.target.value)}
              placeholder="Graduação, Mestrado, Doutorado..."
            />
          </div>

          {/* opcionais */}
          <div className="md:col-span-2 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Aperfeiçoamento</label>
              <input
                className="w-full border rounded-xl p-2 outline-none focus:ring"
                value={improvement}
                onChange={e => setImprovement(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Especialização</label>
              <input
                className="w-full border rounded-xl p-2 outline-none focus:ring"
                value={specialization}
                onChange={e => setSpecialization(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Mestrado</label>
              <input
                className="w-full border rounded-xl p-2 outline-none focus:ring"
                value={mastersDegree}
                onChange={e => setMastersDegree(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Doutorado</label>
              <input
                className="w-full border rounded-xl p-2 outline-none focus:ring"
                value={doctorate}
                onChange={e => setDoctorate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Lotação / Atuação</label>
              <input
                className="w-full border rounded-xl p-2 outline-none focus:ring"
                value={assignment}
                onChange={e => setAssignment(e.target.value)}
                placeholder="Ex.: Campus X"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Departamento</label>
              <input
                className="w-full border rounded-xl p-2 outline-none focus:ring"
                value={department}
                onChange={e => setDepartment(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Divisão</label>
              <input
                className="w-full border rounded-xl p-2 outline-none focus:ring"
                value={division}
                onChange={e => setDivision(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Função</label>
              <input
                className="w-full border rounded-xl p-2 outline-none focus:ring"
                value={role}
                onChange={e => setRole(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Chefia imediata</label>
              <input
                className="w-full border rounded-xl p-2 outline-none focus:ring"
                value={immediateSupervisor}
                onChange={e => setImmediateSupervisor(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Cadastrar"}
          </button>

          <button
            type="button"
            onClick={clearForm}
            className="px-4 py-2 rounded-xl border"
          >
            Limpar
          </button>

          <a href="/login" className="ml-auto text-sm text-blue-600 hover:underline">
            Já tenho conta
          </a>
        </div>

        <p className="text-xs text-gray-500 mt-3">Campos com * são obrigatórios</p>
      </form>
    </div>
  )
}
