export const TIME_ZONE = 'America/Guatemala'
export const FREQUENCIES = [
  { value: 'DAILY', label: 'Diaria' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'YEARLY', label: 'Anual' },
]
export const TYPES = [
  {
    value: 'APPOINTMENT',
    label: 'Cita o consulta',
  },
  {
    value: 'HEARING',
    label: 'Audiencia',
  },
  {
    value: 'PRESENTATION',
    label: 'Presentación',
  },
  {
    value: 'DELIVERY',
    label: 'Entrega',
  },
  {
    value: 'FOLLOW_UP',
    label: 'Seguimiento',
  },
  {
    value: 'PAYMENT_REMINDER',
    label: 'Recordatorio de cobro',
  },
]
export const STATUS_LABELS = {
  SCHEDULED: 'Programada',
  COMPLETED: 'Realizada',
  CANCELLED: 'Cancelada',
}

export const SYNC_LABELS = {
  LOCAL: 'Guardada en la agenda',
  PENDING: 'Sincronización pendiente',
  SYNCED: 'Sincronizada con Google',
  ERROR: 'Requiere atención',
  CONFLICT: 'Cambio externo por revisar',
}
// Normaliza datos de formulario y fechas para los contratos de Agenda; no sustituye las validaciones del backend.
export function inputDate(value = new Date(), timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`
}

export function dayKey(value = new Date()) {
  return inputDate(value).slice(0, 10)
}

export function dayStart(day) {
  return new Date(`${day}T00:00:00-06:00`).toISOString()
}

export function nextDay(day, count = 1) {
  const value = new Date(`${day}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
}

export function monthWindow(day) {
  const start = `${day.slice(0, 7)}-01`
  const end = new Date(`${start}T12:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return {
    from: dayStart(start),
    to: dayStart(end.toISOString().slice(0, 10)),
  }
}

export function monthDays(day) {
  const first = `${day.slice(0, 7)}-01`
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay()
  const offset = (weekday + 6) % 7
  const start = nextDay(first, -offset)
  return Array.from(
    {
      length: 42,
    },
    (_, index) => nextDay(start, index),
  )
}

export function dateLabel(value, options = {}) {
  return new Intl.DateTimeFormat('es-GT', {
    timeZone: TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(new Date(value))
}

export function emptyEvent(day = dayKey()) {
  const start = `${day}T09:00`
  return {
    title: '',
    description: '',
    type: 'APPOINTMENT',
    startsAt: start,
    endsAt: `${day}T10:00`,
    allDay: false,
    location: '',
    caseId: '',
    client: null,
    version: null,
    timeZone: TIME_ZONE,
    repeatFrequency: '',
    repeatUntil: '',
    originalStartsAt: null,
  }
}

export function eventDraft(event) {
  let client = null
  if (event.clientDpi) {
    const names = (event.clientName || 'Cliente').split(' ')
    client = {
      dpi: event.clientDpi,
      firstName: names[0],
      lastName: names.slice(1).join(' '),
    }
  }
  return {
    title: event.title,
    description: event.description || '',
    type: event.type,
    startsAt: inputDate(event.startsAt, event.timeZone || TIME_ZONE),
    endsAt: inputDate(event.endsAt, event.timeZone || TIME_ZONE),
    allDay: event.allDay,
    location: event.location || '',
    caseId: event.caseId || '',
    client,
    version: event.version,
    timeZone: event.timeZone || TIME_ZONE,
    repeatFrequency: event.recurrence?.frequency || '',
    repeatUntil: event.recurrence?.until || '',
    originalStartsAt: event.originalStartsAt || null,
  }
}

export function eventErrors(form) {
  const errors = {}
  if (!form.title.trim() || form.title.trim().length > 150) {
    errors.title = 'Escribe un título de hasta 150 caracteres.'
  }
  if (!TYPES.some((type) => type.value === form.type)) {
    errors.type = 'Selecciona un tipo de actividad.'
  }
  let start = new Date(NaN)
  let end = new Date(NaN)
  try {
    start = new Date(localInputInstant(form.startsAt, form.timeZone || TIME_ZONE))
  } catch {
    errors.startsAt = 'El horario no es válido en la zona seleccionada.'
  }
  try {
    end = new Date(localInputInstant(form.endsAt, form.timeZone || TIME_ZONE))
  } catch {
    errors.endsAt = 'El horario no es válido en la zona seleccionada.'
  }
  if (!form.startsAt || Number.isNaN(start.getTime())) {
    errors.startsAt = 'Selecciona una fecha y hora de inicio.'
  }
  if (!form.endsAt || Number.isNaN(end.getTime()) || end <= start || end - start > 31 * 86400000) {
    errors.endsAt = 'El fin debe ser posterior al inicio y la duración no puede superar 31 días.'
  }
  if (form.allDay && (!form.startsAt.endsWith('T00:00') || !form.endsAt.endsWith('T00:00'))) {
    errors.endsAt = 'Para todo el día utiliza medianoche; el fin es el día posterior.'
  }
  if (['HEARING', 'PAYMENT_REMINDER'].includes(form.type) && !form.caseId) {
    errors.caseId = 'Selecciona el expediente de esta actividad.'
  }
  if (form.type === 'APPOINTMENT' && !form.caseId && !form.client?.dpi) {
    errors.client = 'Selecciona el cliente de la cita.'
  }
  if (
    form.repeatFrequency &&
    !form.originalStartsAt &&
    (!FREQUENCIES.some((item) => item.value === form.repeatFrequency) ||
      !form.repeatUntil ||
      form.repeatUntil < form.startsAt.slice(0, 10) ||
      new Date(form.repeatUntil) - new Date(form.startsAt.slice(0, 10)) > 366 * 86400000)
  ) {
    errors.repeatUntil = 'La repetición requiere un fin dentro de los siguientes 366 días.'
  }
  if (form.description.length > 2000) {
    errors.description = 'Las notas admiten hasta 2000 caracteres.'
  }
  return errors
}

export function eventPayload(form, requestId) {
  let caseId = null
  if (form.caseId) {
    caseId = Number(form.caseId)
  }
  let clientDpi = null
  if (!caseId && form.client?.dpi) {
    clientDpi = form.client.dpi
  }
  let recurrence = null
  if (form.repeatFrequency && !form.originalStartsAt) {
    recurrence = { frequency: form.repeatFrequency, until: form.repeatUntil }
  }
  const payload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    type: form.type,
    startsAt: localInputInstant(form.startsAt, form.timeZone || TIME_ZONE),
    endsAt: localInputInstant(form.endsAt, form.timeZone || TIME_ZONE),
    timeZone: form.timeZone || TIME_ZONE,
    allDay: form.allDay,
    location: form.location.trim() || null,
    caseId,
    clientDpi,
    version: form.version,
    requestId,
  }
  if (recurrence) {
    payload.recurrence = recurrence
  }
  if (form.originalStartsAt) {
    payload.originalStartsAt = form.originalStartsAt
  }
  return payload
}

export function localInputInstant(value, zone = 'America/Guatemala') {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error('La fecha no es válida.')
  }
  const target = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(target)) {
    throw new Error('La fecha no es válida.')
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  let guess = target
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const fields = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]),
    )
    const shown = `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`
    if (shown === value) {
      return new Date(guess).toISOString()
    }
    guess += target - Date.parse(`${shown}:00Z`)
  }
  throw new Error('Ese horario no existe en la zona seleccionada. Elige otro horario.')
}
