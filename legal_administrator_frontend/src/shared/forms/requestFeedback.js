import { useNotificationStore } from '../notifications/notificationStore.js'

export function requestErrorMessage(error, fallback = 'No fue posible completar la acción.') {
  if (error?.status === 401) return 'Tu sesión venció. Inicia sesión nuevamente.'
  if (error?.status === 403) return 'Tu perfil no tiene permiso para realizar esta acción.'
  if (error?.status === 404) return 'El registro ya no está disponible. Actualiza la información.'
  if (error?.status === 0) return 'No fue posible conectar con el servidor. Comprueba tu conexión.'
  if (error?.status >= 500) return 'El servidor no pudo confirmar la operación. Inténtalo nuevamente.'
  return error?.message || fallback
}

export function notifyRequestError(error, fallback, actionLabel = '', action = null) {
  const notifications = useNotificationStore()
  let message = requestErrorMessage(error, fallback)
  const details = Object.values(error?.data?.details || {}).filter(value => typeof value === 'string')
  if (details.length) message += ' ' + details.join(' · ')
  let tone = 'error'
  if (error?.status === 409) tone = 'warning'
  notifications.show(message, tone, actionLabel, action)
}
