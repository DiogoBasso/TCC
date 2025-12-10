import { CreateScoringTableDto } from "../type/dto/scoringTableDto"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { BusinessRuleError } from "./processoService"

export class ScoringTableService {
  constructor(private readonly repo: ScoringTableRepository) {}

  async criarTabelaPontuacao(dto: CreateScoringTableDto) {
    const startsOn = dto.startsOn ? new Date(dto.startsOn) : null
    const endsOn = dto.endsOn ? new Date(dto.endsOn) : null

    if (startsOn && endsOn && endsOn < startsOn) {
      throw new BusinessRuleError("Data final não pode ser anterior à data inicial.")
    }

    const table = await this.repo.createTable({
      name: dto.name,
      startsOn,
      endsOn
    })

    // primeiro pass: criar nodes sem parentId
    const nodeTempList: {
      dtoIndex: number
      nodeId: number
      code: string | null
    }[] = []

    const codeToNodeId = new Map<string, number>()

    for (let i = 0; i < dto.nodes.length; i++) {
      const nodeDto = dto.nodes[i]

      const createdNode = await this.repo.createNode({
        scoringTableId: table.idScoringTable,
        name: nodeDto.name,
        code: nodeDto.code ?? null,
        sortOrder: nodeDto.sortOrder ?? i + 1,
        hasFormula: nodeDto.hasFormula ?? false,
        formulaExpression: nodeDto.formulaExpression ?? null
      })

      nodeTempList.push({
        dtoIndex: i,
        nodeId: createdNode.idScoringNode,
        code: createdNode.code ?? null
      })

      if (createdNode.code) {
        if (codeToNodeId.has(createdNode.code)) {
          throw new BusinessRuleError(
            `Código de bloco duplicado: "${createdNode.code}".`
          )
        }
        codeToNodeId.set(createdNode.code, createdNode.idScoringNode)
      }
    }

    // segundo pass: ajustar parentId
    for (let i = 0; i < dto.nodes.length; i++) {
      const nodeDto = dto.nodes[i]
      const temp = nodeTempList[i]

      if (nodeDto.parentCode) {
        const parentId = codeToNodeId.get(nodeDto.parentCode)
        if (!parentId) {
          throw new BusinessRuleError(
            `Bloco "${nodeDto.name}" referencia parentCode "${nodeDto.parentCode}" que não existe.`
          )
        }

        await this.repo.updateNodeParent(temp.nodeId, parentId)
      }
    }

    // terceiro pass: criar itens
    for (let i = 0; i < dto.nodes.length; i++) {
      const nodeDto = dto.nodes[i]
      const temp = nodeTempList[i]

      for (let j = 0; j < nodeDto.items.length; j++) {
        const itemDto = nodeDto.items[j]

        await this.repo.createItem({
          scoringTableId: table.idScoringTable,
          nodeId: temp.nodeId,
          description: itemDto.description,
          unit: itemDto.unit ?? null,
          points: String(itemDto.points),
          hasMaxPoints: itemDto.hasMaxPoints ?? false,
          maxPoints:
            itemDto.hasMaxPoints && itemDto.maxPoints != null
              ? String(itemDto.maxPoints)
              : null,
          formulaKey: itemDto.formulaKey ?? null
        })
      }
    }

    return {
      idScoringTable: table.idScoringTable,
      name: table.name,
      startsOn: table.startsOn,
      endsOn: table.endsOn
    }
  }
}
