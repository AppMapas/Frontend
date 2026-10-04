const starterStages = [
  { code: 'PRESENTADO', name: 'Presentado', initial: true, terminal: false },
  { code: 'EN_REVISION', name: 'En revisión', initial: false, terminal: false },
  { code: 'APROBADO', name: 'Aprobado', initial: false, terminal: false },
  { code: 'ENTREGADO', name: 'Entregado', initial: false, terminal: true },
]

export function createStageDraft(configuration) {
  if (!configuration?.stages?.length) {
    return {
      version: configuration?.version ?? 0,
      stages: starterStages.map((stage, index) => ({ ...stage, key: index + 1 })),
      transitions: [
        { fromKey: 1, toKey: 2 },
        { fromKey: 2, toKey: 3 },
        { fromKey: 3, toKey: 4 },
      ],
    }
  }
  const stages = configuration.stages.map((stage, index) => ({ ...stage, key: index + 1 }))
  const keyByCode = new Map(stages.map(stage => [stage.code, stage.key]))
  return {
    version: configuration.version,
    stages,
    transitions: configuration.transitions.map(edge => ({
      fromKey: keyByCode.get(edge.fromCode),
      toKey: keyByCode.get(edge.toCode),
    })),
  }
}

export function stagePayload(draft) {
  const byKey = new Map(draft.stages.map(stage => [stage.key, stage.code.trim()]))
  return {
    version: draft.version,
    stages: draft.stages.map((stage, index) => ({
      code: stage.code.trim(),
      name: stage.name.trim(),
      displayOrder: index + 1,
      initial: Boolean(stage.initial),
      terminal: Boolean(stage.terminal),
    })),
    transitions: draft.transitions.map(edge => ({
      fromCode: byKey.get(edge.fromKey),
      toCode: byKey.get(edge.toKey),
    })),
  }
}

function reachable(startKeys, edges, reverse = false) {
  const seen = new Set(startKeys)
  const queue = [...startKeys]
  while (queue.length) {
    const current = queue.shift()
    for (const edge of edges) {
      let next = null
      if (!reverse && edge.fromKey === current) next = edge.toKey
      if (reverse && edge.toKey === current) next = edge.fromKey
      if (next !== null && !seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

export function validateStageDraft(draft) {
  const stages = draft.stages
  if (stages.length < 2 || stages.length > 40) return 'Configura entre 2 y 40 etapas.'
  const codes = new Set()
  const names = new Set()
  for (const stage of stages) {
    const code = stage.code.trim()
    const name = stage.name.trim()
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) {
      return 'Cada código debe tener de 2 a 40 caracteres: mayúsculas, números o guion bajo, comenzando con una letra.'
    }
    if (!name || name.length > 150) return 'Cada etapa necesita un nombre de hasta 150 caracteres.'
    if (codes.has(code) || names.has(name.toLocaleLowerCase('es'))) {
      return 'Los códigos y nombres de las etapas deben ser únicos.'
    }
    codes.add(code)
    names.add(name.toLocaleLowerCase('es'))
  }
  const initial = stages.filter(stage => stage.initial)
  const finalStages = stages.filter(stage => stage.terminal)
  if (initial.length !== 1 || !finalStages.length) {
    return 'Selecciona una etapa inicial y al menos una etapa final.'
  }
  const keys = new Set(stages.map(stage => stage.key))
  const edgeKeys = new Set()
  for (const edge of draft.transitions) {
    const from = stages.find(stage => stage.key === edge.fromKey)
    const key = edge.fromKey + ':' + edge.toKey
    if (!keys.has(edge.fromKey) || !keys.has(edge.toKey) || edge.fromKey === edge.toKey || from.terminal || edgeKeys.has(key)) {
      return 'Revisa las transiciones: no pueden repetirse, volver a la misma etapa ni salir de una etapa final.'
    }
    edgeKeys.add(key)
  }
  const fromStart = reachable([initial[0].key], draft.transitions)
  const toEnd = reachable(finalStages.map(stage => stage.key), draft.transitions, true)
  if (fromStart.size !== stages.length || toEnd.size !== stages.length) {
    return 'Cada etapa debe ser alcanzable desde la inicial y permitir llegar a una etapa final.'
  }
  return ''
}
