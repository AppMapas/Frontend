// Un acceso directo válido prevalece sobre el inicio por rol, también después del segundo factor.
export function defaultHome(role) {
  if (['Abogada', 'Administrador'].includes(role)) {
    return '/inicio'
  }
  return '/terrenos'
}

export function explicitRedirect(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u001f]/.test(value)
  ) {
    return null
  }
  if (['/login', '/verificacion', '/auth'].includes(value.split(/[?#]/)[0])) {
    return null
  }
  return value
}

export function loginRedirect(value, role) {
  return explicitRedirect(value) || defaultHome(role)
}
