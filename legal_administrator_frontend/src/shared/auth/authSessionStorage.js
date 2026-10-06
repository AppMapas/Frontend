const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'authUser'
const TWO_FACTOR_KEY = 'twoFactorEnabled'

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function parseUser(value) {
  if (!value) return null
  try {
    const user = JSON.parse(value)
    return user && typeof user.email === 'string' ? user : null
  } catch {
    return null
  }
}

/** Las respuestas de login y renovación contienen menos datos que el perfil. */
export function mapAuthUser(response, previousUser = null) {
  if (!response?.email) return null
  const user = {
    email: response.email,
    firstName: response.firstName,
    lastName: response.lastName,
    name: [response.firstName, response.lastName].filter(Boolean).join(' '),
    role: response.role ?? response.roleName,
  }
  const sameAccount = previousUser?.email === response.email
  const profileFields = ['dpi', 'age', 'maritalStatusName', 'nationalityName', 'createdAt']
  for (const field of profileFields) {
    if (response[field] !== undefined) user[field] = response[field]
    else if (sameAccount) user[field] = previousUser[field]
  }
  return user
}

export function readPersistedAuthSession() {
  const storage = getStorage()
  if (!storage) return null
  try {
    const accessToken = storage.getItem(ACCESS_TOKEN_KEY)
    const refreshToken = storage.getItem(REFRESH_TOKEN_KEY)
    const user = parseUser(storage.getItem(USER_KEY))

    if (!accessToken || !refreshToken || !user) return null

    return {
      accessToken,
      refreshToken,
      user,
      twoFactorEnabled: storage.getItem(TWO_FACTOR_KEY) === 'true',
    }
  } catch {
    return null
  }
}

export function persistAuthSession({ accessToken, refreshToken, user, twoFactorEnabled = false }) {
  const storage = getStorage()
  if (!storage || !accessToken || !refreshToken || !user?.email) return
  try {
    storage.setItem(ACCESS_TOKEN_KEY, accessToken)
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    storage.setItem(USER_KEY, JSON.stringify(user))
    storage.setItem(TWO_FACTOR_KEY, String(Boolean(twoFactorEnabled)))
  } catch {
    // La autenticación continúa en memoria si el navegador bloquea localStorage.
  }
}

// Interceptor de respuestas de autenticación. Captura tanto el login como el
// refresh y 2FA porque todos devuelven response.accessToken/refreshToken.
export function interceptAuthResponse(response) {
  if (!response?.accessToken || !response?.refreshToken) return

  const previous = readPersistedAuthSession()
  persistAuthSession({
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: mapAuthUser(response, previous?.user),
    twoFactorEnabled: response.twoFactorEnabled ?? previous?.twoFactorEnabled ?? false,
  })
}

export function clearPersistedAuthSession() {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(ACCESS_TOKEN_KEY)
    storage.removeItem(REFRESH_TOKEN_KEY)
    storage.removeItem(USER_KEY)
    storage.removeItem(TWO_FACTOR_KEY)
  } catch {
    // No hay nada adicional que limpiar si el almacenamiento está bloqueado.
  }
}
