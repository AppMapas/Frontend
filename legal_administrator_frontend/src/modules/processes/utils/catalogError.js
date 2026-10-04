export function catalogErrorMessage(error, fallback) {
  if (error?.status === 401) {
    return 'Tu sesión venció. Inicia sesión nuevamente.'
  }
  if (error?.status === 403) {
    return 'Tu perfil no tiene permiso para realizar esta acción.'
  }
  if (error?.status === 0) {
    return 'No fue posible conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'
  }
  return error?.message || fallback
}
