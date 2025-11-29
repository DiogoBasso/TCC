"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Modal from "@/components/Modal"

type ModalVariant = "success" | "error" | "info"

type ApiResponse<T> = {
  status: string
  message: string
  data: T | null
}

type ModalState = {
  open: boolean
  title: string
  message: string
  variant: ModalVariant
}

type NodeDraft = {
  id: string
  name: string
  code: string
  parentNodeId: string | null
  sortOrder: number
  hasFormula: boolean
  formulaExpression: string
}

type ItemDraft = {
  id: string
  nodeId: string
  description: string
  unit: string
  points: string
  hasMaxPoints: boolean
  maxPoints: string
  formulaKey: string
}

type BlockDraft = {
  id: string
  name: string
  nodes: NodeDraft[]
  items: ItemDraft[]
}

export default function NovaTabelaPontuacaoPage() {
  const router = useRouter()

  const [tableName, setTableName] = useState("")
  const [blocks, setBlocks] = useState<BlockDraft[]>([])

  const [currentBlockName, setCurrentBlockName] = useState("")
  const [currentNodes, setCurrentNodes] = useState<NodeDraft[]>([
    {
      id: "node-1",
      name: "",
      code: "",
      parentNodeId: null,
      sortOrder: 1,
      hasFormula: false,
      formulaExpression: ""
    }
  ])

  const [currentItems, setCurrentItems] = useState<ItemDraft[]>([
    {
      id: "item-1",
      nodeId: "",
      description: "",
      unit: "",
      points: "0.00",
      hasMaxPoints: false,
      maxPoints: "",
      formulaKey: ""
    }
  ])

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)

  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  })

  function openModal(partial: Partial<ModalState>) {
    setModal(prev => ({
      ...prev,
      open: true,
      title: partial.title ?? prev.title,
      message: partial.message ?? prev.message,
      variant: partial.variant ?? prev.variant
    }))
  }

  function closeModal() {
    setModal(prev => ({ ...prev, open: false }))
  }

  // ---------- helpers de nó / item do bloco atual ----------

  function addNode() {
    setCurrentNodes(prev => [
      ...prev,
      {
        id: `node-${prev.length + 1}`,
        name: "",
        code: "",
        parentNodeId: null,
        sortOrder: prev.length + 1,
        hasFormula: false,
        formulaExpression: ""
      }
    ])
  }

  function updateNode(id: string, patch: Partial<NodeDraft>) {
    setCurrentNodes(prev =>
      prev.map(node =>
        node.id === id ? { ...node, ...patch } : node
      )
    )
  }

  function removeNode(id: string) {
    setCurrentNodes(prev => prev.filter(n => n.id !== id))
    // itens ligados a esse nó continuam com nodeId inválido até você ajustar
    setCurrentItems(prev =>
      prev.map(item =>
        item.nodeId === id ? { ...item, nodeId: "" } : item
      )
    )
  }

  function addItem() {
    setCurrentItems(prev => [
      ...prev,
      {
        id: `item-${prev.length + 1}`,
        nodeId: "",
        description: "",
        unit: "",
        points: "0.00",
        hasMaxPoints: false,
        maxPoints: "",
        formulaKey: ""
      }
    ])
  }

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setCurrentItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, ...patch } : item
      )
    )
  }

  function removeItem(id: string) {
    setCurrentItems(prev => prev.filter(i => i.id !== id))
  }

  // ---------- validações ----------

  function validateCurrentBlock(): string | null {
    if (!currentBlockName.trim()) {
      return "Informe o nome do bloco (ex: DOCÊNCIA, PRODUÇÃO)."
    }

    if (currentNodes.length === 0) {
      return "Cadastre pelo menos um nó/linha dentro do bloco."
    }

    const codeSet = new Set<string>()
    for (const node of currentNodes) {
      if (!node.name.trim()) {
        return "Todos os nós precisam de um nome."
      }
      if (!node.code.trim()) {
        return `O nó "${node.name}" precisa de um código.`
      }

      const codeUpper = node.code.trim().toUpperCase()
      if (codeSet.has(codeUpper)) {
        return `Código duplicado dentro do bloco: "${codeUpper}". Dentro do mesmo bloco, cada nó precisa de um código único.`
      }
      codeSet.add(codeUpper)

      if (node.hasFormula && !node.formulaExpression.trim()) {
        return `O nó "${node.name}" está marcado como calculado, mas a fórmula não foi informada.`
      }

      if (node.parentNodeId) {
        const parentExists = currentNodes.some(n => n.id === node.parentNodeId)
        if (!parentExists) {
          return `O nó "${node.name}" referencia um pai que não existe mais. Ajuste o pai.`
        }
      }
    }

    if (currentItems.length === 0) {
      return "Cadastre pelo menos um item de pontuação neste bloco."
    }

    const nodeIdSet = new Set(currentNodes.map(n => n.id))

    for (const item of currentItems) {
      if (!item.description.trim()) {
        return "Há item de pontuação sem descrição."
      }
      if (!item.nodeId) {
        return `O item "${item.description}" não está vinculado a nenhum nó. Selecione o nó.`
      }
      if (!nodeIdSet.has(item.nodeId)) {
        return `O item "${item.description}" está vinculado a um nó que não existe mais. Ajuste a vinculação.`
      }
      if (item.hasMaxPoints && !item.maxPoints) {
        return `O item "${item.description}" está marcado com pontuação máxima, mas o valor máximo não foi informado.`
      }
      if (item.formulaKey && !/^[A-Z][A-Z0-9_]*$/.test(item.formulaKey)) {
        return `O item "${item.description}" possui formulaKey inválida. Use algo como MNP, NSI, A1 (somente letras maiúsculas, números e "_", começando com letra).`
      }
    }

    return null
  }

  function validateBeforeSaveTable(): string | null {
    if (!tableName.trim()) {
      return "Informe o nome da tabela de pontuação."
    }
    if (blocks.length === 0) {
      return "Cadastre pelo menos um bloco e clique em \"Salvar bloco\" antes de salvar a tabela."
    }

    // validar códigos únicos entre todos os blocos
    const codeSetGlobal = new Set<string>()
    for (const block of blocks) {
      for (const node of block.nodes) {
        const codeUpper = node.code.trim().toUpperCase()
        if (codeSetGlobal.has(codeUpper)) {
          return `Código de nó duplicado entre blocos: "${codeUpper}". Cada nó da tabela precisa de código único.`
        }
        codeSetGlobal.add(codeUpper)
      }
    }

    return null
  }

  // ---------- manipulação de blocos ----------

  function resetCurrentBlockEditor() {
    setCurrentBlockName("")
    setCurrentNodes([
      {
        id: "node-1",
        name: "",
        code: "",
        parentNodeId: null,
        sortOrder: 1,
        hasFormula: false,
        formulaExpression: ""
      }
    ])
    setCurrentItems([
      {
        id: "item-1",
        nodeId: "",
        description: "",
        unit: "",
        points: "0.00",
        hasMaxPoints: false,
        maxPoints: "",
        formulaKey: ""
      }
    ])
    setEditingBlockId(null)
  }

  function handleSaveBlock() {
    const error = validateCurrentBlock()
    if (error) {
      openModal({
        title: "Dados inválidos no bloco",
        message: error,
        variant: "error"
      })
      return
    }

    const normalizedNodes = currentNodes.map((n, index) => ({
      ...n,
      code: n.code.trim().toUpperCase(),
      sortOrder: n.sortOrder || index + 1
    }))

    const blockDraft: BlockDraft = {
      id: editingBlockId ?? `block-${blocks.length + 1}`,
      name: currentBlockName.trim(),
      nodes: normalizedNodes,
      items: currentItems
    }

    if (editingBlockId) {
      setBlocks(prev =>
        prev.map(b => (b.id === editingBlockId ? blockDraft : b))
      )
    } else {
      setBlocks(prev => [...prev, blockDraft])
    }

    openModal({
      title: "Bloco salvo",
      message: "Bloco salvo com sucesso. Você pode cadastrar outro bloco ou salvar a tabela.",
      variant: "success"
    })

    resetCurrentBlockEditor()
  }

  function handleEditBlock(id: string) {
    const block = blocks.find(b => b.id === id)
    if (!block) return

    setEditingBlockId(block.id)
    setCurrentBlockName(block.name)
    setCurrentNodes(block.nodes)
    setCurrentItems(block.items)
  }

  function handleRemoveBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id))
    if (editingBlockId === id) {
      resetCurrentBlockEditor()
    }
  }

  // ---------- salvar tabela completa ----------

  async function handleSaveTable(e: React.FormEvent) {
    e.preventDefault()

    const error = validateBeforeSaveTable()
    if (error) {
      openModal({
        title: "Não foi possível salvar a tabela",
        message: error,
        variant: "error"
      })
      return
    }

    setSubmitting(true)

    // montar payload unificando todos os blocos
    // 1. juntar todos os nós
    const allNodes: NodeDraft[] = blocks.flatMap(b => b.nodes)
    const allItems: ItemDraft[] = blocks.flatMap(b => b.items)

    // map de nodeId -> node e de code -> nodeId
    const nodeById = new Map<string, NodeDraft>()
    const codeByNodeId = new Map<string, string>()

    allNodes.forEach(node => {
      nodeById.set(node.id, node)
      codeByNodeId.set(node.id, node.code.trim().toUpperCase())
    })

    // agrupar itens por código de nó
    const itemsByNodeCode = new Map<string, ItemDraft[]>()
    allItems.forEach(item => {
      const nodeId = item.nodeId
      const node = nodeById.get(nodeId)
      if (!node) return
      const codeUpper = node.code.trim().toUpperCase()
      const list = itemsByNodeCode.get(codeUpper) ?? []
      list.push(item)
      itemsByNodeCode.set(codeUpper, list)
    })

    const payload = {
      name: tableName.trim(),
      startsOn: "",
      endsOn: "",
      nodes: allNodes.map((node, index) => {
        const codeUpper = node.code.trim().toUpperCase()
        let parentCode = ""
        if (node.parentNodeId) {
          const parentCodeUpper = codeByNodeId.get(node.parentNodeId) || ""
          parentCode = parentCodeUpper
        }

        const itemsForNode = itemsByNodeCode.get(codeUpper) ?? []

        return {
          name: node.name.trim(),
          code: codeUpper,
          sortOrder: node.sortOrder || index + 1,
          parentCode,
          hasFormula: node.hasFormula,
          formulaExpression: node.hasFormula
            ? node.formulaExpression.trim()
            : "",
          items: itemsForNode.map(item => ({
            description: item.description.trim(),
            unit: item.unit.trim() || "",
            points: item.points || "0.00",
            hasMaxPoints: item.hasMaxPoints,
            maxPoints:
              item.hasMaxPoints && item.maxPoints
                ? item.maxPoints
                : "",
            formulaKey: item.formulaKey.trim().toUpperCase() || ""
          }))
        }
      })
    }

    try {
      const r = await fetch("/api/admin/tabelas-pontuacao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      const json: ApiResponse<{ idScoringTable: number }> =
        await r.json().catch(() => ({
          status: "error",
          message: "Falha ao ler resposta",
          data: null
        }))

      if (!r.ok) {
        openModal({
          title: "Erro ao criar tabela",
          message: json?.message || "Não foi possível salvar a tabela de pontuação.",
          variant: "error"
        })
        return
      }

      const idTable = json?.data?.idScoringTable

      openModal({
        title: "Tabela criada",
        message: idTable
          ? `Tabela de pontuação criada com sucesso (ID ${idTable}).`
          : "Tabela de pontuação criada com sucesso.",
        variant: "success"
      })

      setTimeout(() => {
        router.push("/dashboard")
      }, 800)
    } catch (err) {
      console.error("Erro ao criar tabela de pontuação:", err)
      openModal({
        title: "Erro inesperado",
        message: "Ocorreu um erro ao comunicar com o servidor.",
        variant: "error"
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- UI ----------

  return (
    <main className="p-6 flex flex-col min-h-screen bg-gray-50">
      <header className="flex justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold">
          Nova Tabela de Pontuação
        </h1>
      </header>

      <section className="max-w-6xl">
        <form
          onSubmit={handleSaveTable}
          className="space-y-8 bg-white border border-slate-200 rounded-2xl shadow-sm p-5"
        >
          {/* Nome da tabela */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">
              Dados da tabela
            </h2>
            <div>
              <label className="block text-sm font-medium mb-1">
                Nome da tabela *
              </label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                placeholder="Ex: Tabela de Pontuação 2025"
              />
            </div>
          </div>

          {/* Blocos já salvos */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold">
                Blocos já cadastrados
              </h2>
              <span className="text-xs text-slate-500">
                Cada bloco representa uma parte da planilha (ex: DOCÊNCIA, PRODUÇÃO).
              </span>
            </div>

            {blocks.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhum bloco cadastrado ainda. Use o formulário abaixo para criar o primeiro bloco.
              </p>
            ) : (
              <div className="space-y-2">
                {blocks.map(block => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                  >
                    <div className="text-xs">
                      <div className="font-semibold">
                        {block.name}
                      </div>
                      <div className="text-slate-500">
                        {block.nodes.length} nós • {block.items.length} itens
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-100"
                        onClick={() => handleEditBlock(block.id)}
                      >
                        Editar bloco
                      </button>
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveBlock(block.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Editor de bloco atual */}
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold">
                {editingBlockId
                  ? "Editar bloco"
                  : "Novo bloco"}
              </h2>
              {editingBlockId && (
                <span className="text-xs text-slate-500">
                  Editando bloco já salvo. Ao salvar, ele será atualizado.
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nome do bloco *
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                  value={currentBlockName}
                  onChange={e => setCurrentBlockName(e.target.value)}
                  placeholder='Ex: "DOCÊNCIA", "PRODUÇÃO"'
                />
                <p className="mt-1 text-xs text-slate-500">
                  Esse é o nome da seção principal da planilha. Dentro dela você cria as linhas (nós) e itens.
                </p>
              </div>

              {/* Nós do bloco */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold">
                    Nós / linhas do bloco
                  </h3>
                  <button
                    type="button"
                    onClick={addNode}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
                  >
                    Adicionar nó
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Cada nó representa uma linha ou agrupamento: ex:
                  "DOCÊNCIA", "1 - Número de horas aula",
                  "2 - Atividade regular de docência...",
                  "2a - Modalidades de ensino", etc.
                </p>

                <div className="space-y-3">
                  {currentNodes.map((node, index) => (
                    <div
                      key={node.id}
                      className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-3"
                    >
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-xs font-semibold">
                          Nó {index + 1}
                        </span>
                        {currentNodes.length > 1 && (
                          <button
                            type="button"
                            className="text-[11px] text-red-600 hover:underline"
                            onClick={() => removeNode(node.id)}
                          >
                            Remover nó
                          </button>
                        )}
                      </div>

                      <div className="grid md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium mb-1">
                            Nome *
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                            value={node.name}
                            onChange={e =>
                              updateNode(node.id, {
                                name: e.target.value
                              })
                            }
                            placeholder='Ex: "DOCÊNCIA", "1 - Número de horas aula"'
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Código *
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                            value={node.code}
                            onChange={e =>
                              updateNode(node.id, {
                                code: e.target.value.toUpperCase()
                              })
                            }
                            placeholder="Ex: DOC, DOC-1, DOC-2-A"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Ordem
                          </label>
                          <input
                            type="number"
                            className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                            value={node.sortOrder}
                            min={0}
                            onChange={e =>
                              updateNode(node.id, {
                                sortOrder: Number(e.target.value || "0")
                              })
                            }
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Nó pai
                          </label>
                          <select
                            className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                            value={node.parentNodeId ?? ""}
                            onChange={e =>
                              updateNode(node.id, {
                                parentNodeId: e.target.value || null
                              })
                            }
                          >
                            <option value="">
                              Sem pai (raiz dentro do bloco)
                            </option>
                            {currentNodes
                              .filter(n => n.id !== node.id)
                              .map(n => (
                                <option key={n.id} value={n.id}>
                                  {n.code || "SEM-CODIGO"} – {n.name}
                                </option>
                              ))}
                          </select>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Isso define a hierarquia: ex: "DOC-1" filho de "DOC", "DOC-2-A" filho de "DOC-2".
                          </p>
                        </div>

                        <div className="md:col-span-3 flex flex-wrap items-center gap-3 mt-1">
                          <label className="inline-flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={node.hasFormula}
                              onChange={e =>
                                updateNode(node.id, {
                                  hasFormula: e.target.checked
                                })
                              }
                            />
                            <span>Nó calculado por fórmula</span>
                          </label>

                          {node.hasFormula && (
                            <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                              <span
                                className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-slate-200 text-[10px] font-semibold cursor-default"
                                title="Este nó será calculado a partir das variáveis definidas em formulaKey dos itens vinculados a ele. Ex: (MNP + (MND * 2) + NT) * NSI."
                              >
                                ?
                              </span>
                              <span>
                                Dica: use as formulaKey dos itens como variáveis, ex: MNP, NSI.
                              </span>
                            </div>
                          )}
                        </div>

                        {node.hasFormula && (
                          <div className="md:col-span-4">
                            <label className="block text-xs font-medium mb-1">
                              Fórmula do nó *
                            </label>
                            <input
                              type="text"
                              className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                              value={node.formulaExpression}
                              onChange={e =>
                                updateNode(node.id, {
                                  formulaExpression: e.target.value
                                })
                              }
                              placeholder='Ex: (MNP + (MND * 2) + NT) * NSI'
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Itens do bloco */}
              <div className="space-y-3 border-t border-slate-200 pt-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold">
                    Itens de pontuação do bloco
                  </h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
                  >
                    Adicionar item
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Cada item precisa estar vinculado a um nó. Para nós calculados, use o campo{" "}
                  <span className="font-semibold">formulaKey</span> como variável na fórmula.
                </p>

                <div className="space-y-3">
                  {currentItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-3"
                    >
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-xs font-semibold">
                          Item {index + 1}
                        </span>
                        {currentItems.length > 1 && (
                          <button
                            type="button"
                            className="text-[11px] text-red-600 hover:underline"
                            onClick={() => removeItem(item.id)}
                          >
                            Remover item
                          </button>
                        )}
                      </div>

                      <div className="grid md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium mb-1">
                            Descrição *
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                            value={item.description}
                            onChange={e =>
                              updateItem(item.id, {
                                description: e.target.value
                              })
                            }
                            placeholder="Ex: Número de horas-aula no interstício"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Nó
                          </label>
                          <select
                            className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                            value={item.nodeId}
                            onChange={e =>
                              updateItem(item.id, {
                                nodeId: e.target.value
                              })
                            }
                          >
                            <option value="">
                              Selecione...
                            </option>
                            {currentNodes.map(node => (
                              <option key={node.id} value={node.id}>
                                {node.code || "SEM-CODIGO"} – {node.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Unidade
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                            value={item.unit}
                            onChange={e =>
                              updateItem(item.id, {
                                unit: e.target.value
                              })
                            }
                            placeholder="Ex: horas, disciplinas, turmas"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Pontos por unidade
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                            value={item.points}
                            onChange={e =>
                              updateItem(item.id, {
                                points: e.target.value
                              })
                            }
                          />
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <input
                            id={`hasMax-${item.id}`}
                            type="checkbox"
                            className="h-4 w-4"
                            checked={item.hasMaxPoints}
                            onChange={e =>
                              updateItem(item.id, {
                                hasMaxPoints: e.target.checked
                              })
                            }
                          />
                          <label
                            htmlFor={`hasMax-${item.id}`}
                            className="text-xs"
                          >
                            Possui pontuação máxima
                          </label>
                        </div>

                        {item.hasMaxPoints && (
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Máximo de pontos
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                              value={item.maxPoints}
                              onChange={e =>
                                updateItem(item.id, {
                                  maxPoints: e.target.value
                                })
                              }
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            formulaKey
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                            value={item.formulaKey}
                            onChange={e =>
                              updateItem(item.id, {
                                formulaKey: e.target.value.toUpperCase()
                              })
                            }
                            placeholder="Ex: MNP, MND, NT, NSI"
                          />
                          <p className="mt-1 text-[10px] text-slate-500">
                            Para nós calculados, essa chave vira variável na fórmula do nó.
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* botões de bloco */}
              <div className="flex justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetCurrentBlockEditor}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs hover:bg-slate-100"
                >
                  Limpar bloco atual
                </button>
                <button
                  type="button"
                  onClick={handleSaveBlock}
                  className="px-4 py-2 rounded-lg text-xs bg-slate-900 text-white hover:bg-slate-800"
                >
                  {editingBlockId ? "Atualizar bloco" : "Salvar bloco"}
                </button>
              </div>
            </div>
          </div>

          {/* Rodapé: salvar tabela */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-100"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Salvando tabela..." : "Salvar tabela completa"}
            </button>
          </div>
        </form>
      </section>

      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={closeModal}
      />
    </main>
  )
}
