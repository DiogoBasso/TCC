export interface CreateScoringItemDto {
  description: string
  unit?: string
  points: string
  hasMaxPoints?: boolean
  maxPoints?: string | null
  formulaKey?: string | null
}

export interface CreateScoringNodeDto {
  name: string
  code?: string | null
  sortOrder?: number
  parentCode?: string | null
  hasFormula?: boolean
  formulaExpression?: string | null
  items: CreateScoringItemDto[]
}

export interface CreateScoringTableDto {
  name: string
  startsOn?: string | null
  endsOn?: string | null
  nodes: CreateScoringNodeDto[]
}
