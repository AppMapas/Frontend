import { validDay } from '../../../shared/date/calendarDay.js'
export { validDay } from '../../../shared/date/calendarDay.js'
export const REMINDER_LABELS = {
  TODAY: 'Para hoy',
  UPCOMING: 'Próximo recordatorio',
  UNATTENDED: 'Pendiente de atender',
}

export function activityRoute(activity, fallbackDay) {
  let day = fallbackDay
  if (activity?.startsAt) {
    day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(
      new Date(activity.startsAt),
    )
  }
  const query = { day }
  if (Number.isSafeInteger(activity?.id) && activity.id > 0) {
    query.activity = String(activity.id)
    if (activity.originalStartsAt) {
      query.originalStartsAt = activity.originalStartsAt
    }
  }
  return { name: 'agenda', query }
}

export function validActivity(activity) {
  return (
    activity &&
    Number.isSafeInteger(activity.id) &&
    activity.id > 0 &&
    typeof activity.title === 'string' &&
    activity.title.length <= 150 &&
    Number.isFinite(Date.parse(activity.startsAt)) &&
    Number.isFinite(Date.parse(activity.endsAt)) &&
    Date.parse(activity.endsAt) > Date.parse(activity.startsAt)
  )
}

export function validateSummary(value) {
  const counts = [
    value?.activeCases,
    value?.todayActivities,
    value?.reminders?.today,
    value?.reminders?.upcoming,
    value?.reminders?.unattended,
  ]
  if (
    !value ||
    !validDay(value.date) ||
    value.timeZone !== 'America/Guatemala' ||
    !Number.isFinite(Date.parse(value.generatedAt)) ||
    counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
    !Array.isArray(value.agenda) ||
    value.agenda.length > 8 ||
    value.agenda.some((activity) => !validActivity(activity)) ||
    !Array.isArray(value.reminderPreview) ||
    value.reminderPreview.length > 5 ||
    value.reminderPreview.some((reminder) => !validReminder(reminder)) ||
    !validDay(value.unattendedFrom) ||
    !validDay(value.upcomingThrough) ||
    !Array.isArray(value.week) ||
    value.week.length !== 7 ||
    value.week.some((day) => !validDay(day.date) || !Number.isSafeInteger(day.count) || day.count < 0)
  ) {
    throw new Error('El servidor no devolvió un resumen válido. Actualiza la información.')
  }
  return value
}

export function googleActivityRoute(event, day) {
  return { name: 'agenda', query: { day, googleEvent: event.id } }
}

export function validReminder(reminder) {
  return reminder && Object.hasOwn(REMINDER_LABELS, reminder.kind) && validActivity(reminder.activity)
}

export function validateRemindersPage(value) {
  const page = value?.reminders
  if (
    !value ||
    !validDay(value.date) ||
    !validDay(value.unattendedFrom) ||
    !validDay(value.upcomingThrough) ||
    !page ||
    !Array.isArray(page.content) ||
    page.content.length > 25 ||
    page.content.some((item) => !validReminder(item)) ||
    !Number.isSafeInteger(page.page) ||
    page.page < 0 ||
    !Number.isSafeInteger(page.size) ||
    page.size < 1 ||
    page.size > 25 ||
    !Number.isSafeInteger(page.totalPages) ||
    page.totalPages < 0 ||
    !Number.isSafeInteger(page.totalElements) ||
    page.totalElements < 0
  ) {
    throw new Error('La consulta de recordatorios recibida no es válida.')
  }
  return value
}
