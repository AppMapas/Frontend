import { dayStart, nextDay } from './agenda.js'

// Utilidades de visualización: usan fechas locales del calendario y respetan el fin exclusivo de eventos de todo el día.
// Identifica una ocurrencia local por su fecha original; los eventos externos conservan su ID de Google.
export function eventKey(event) {
  let occurrence = ''
  if (event.originalStartsAt) {
    occurrence = new Date(event.originalStartsAt).toISOString()
  }
  if (event.origin === 'GOOGLE') {
    return `google:${event.id}`
  }
  return `local:${event.id}:${occurrence}`
}
// La correspondencia local prevalece al mezclar orígenes; un cambio remoto se marca para reconciliación.
export function mergeEvents(local, external) {
  const result = local.map((event) => ({ ...event, origin: 'LOCAL', externalChange: false }))
  const indexes = new Map(result.map((event, index) => [eventKey(event), index]))
  const seen = new Set()
  for (const event of external) {
    if (seen.has(event.id)) {
      continue
    }
    seen.add(event.id)
    let occurrence = ''
    if (event.originalStartsAt) {
      occurrence = new Date(event.originalStartsAt).toISOString()
    }
    const linkedKey = `local:${event.localEventId}:${occurrence}`
    if (event.localEventId && indexes.has(linkedKey)) {
      const index = indexes.get(linkedKey)
      result[index] = { ...result[index], externalChange: event.linkedConflict, externalEvent: event }
      continue
    }
    result.push({ ...event, origin: 'GOOGLE', type: 'FOLLOW_UP', syncState: 'GOOGLE', status: 'SCHEDULED' })
  }
  return result.sort((first, second) => new Date(first.startsAt) - new Date(second.startsAt))
}

export function weekDays(day) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  const first = nextDay(day, -((weekday + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => nextDay(first, index))
}
// El fin es exclusivo: un evento que termina a medianoche no ocupa el día siguiente.
export function overlapsDay(event, day) {
  return (
    Date.parse(event.startsAt) < Date.parse(dayStart(nextDay(day))) &&
    Date.parse(event.endsAt) > Date.parse(dayStart(day))
  )
}

export function dayCounts(events, days) {
  return days.map((date) => ({ date, count: events.filter((event) => overlapsDay(event, date)).length }))
}

export function eventsForDay(events, day) {
  return events.filter((event) => overlapsDay(event, day))
}

export function weekPlacements(events, day) {
  const beginning = Date.parse(dayStart(day))
  const finish = Date.parse(dayStart(nextDay(day)))
  const pixelsPerMinute = 0.9
  const minimumHeight = 44
  const rows = eventsForDay(events, day)
    .filter((event) => !event.allDay)
    .map((event) => {
      const start = Math.max(beginning, Date.parse(event.startsAt))
      const actualEnd = Math.min(finish, Date.parse(event.endsAt))
      const height = Math.min(
        ((finish - start) / 60000) * pixelsPerMinute,
        Math.max(minimumHeight, ((actualEnd - start) / 60000) * pixelsPerMinute),
      )
      return { event, start, end: start + (height / pixelsPerMinute) * 60000, height }
    })
    .sort((first, second) => first.start - second.start)
  const groups = []
  for (const row of rows) {
    let group = groups.at(-1)
    if (!group || row.start >= group.end) {
      group = { end: 0, rows: [] }
      groups.push(group)
    }
    group.rows.push(row)
    group.end = Math.max(group.end, row.end)
  }
  const placements = new Map()
  for (const group of groups) {
    const ends = []
    for (const row of group.rows) {
      let column = ends.findIndex((end) => end <= row.start)
      if (column < 0) {
        column = ends.length
      }
      ends[column] = row.end
      row.column = column
    }
    const columns = Math.max(1, ends.length)
    for (const row of group.rows) {
      placements.set(eventKey(row.event), {
        top: `${((row.start - beginning) / 60000) * pixelsPerMinute}px`,
        height: `${row.height}px`,
        left: `${(row.column * 100) / columns}%`,
        width: `${100 / columns}%`,
      })
    }
  }
  return placements
}
