import { httpClient } from '@/shared/api/httpClient'

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()

export const usersApi = {
  async getCurrentByEmail(email) {
    const targetEmail = normalizeEmail(email)
    if (!targetEmail) throw new Error('No fue posible identificar el correo de la sesión.')

    const users = await httpClient('/users')
    if (!Array.isArray(users)) throw new Error('El servidor no devolvió una lista de usuarios válida.')

    const matches = users.filter((user) => normalizeEmail(user?.email) === targetEmail)
    if (matches.length !== 1) {
      throw new Error(matches.length
        ? 'Hay más de un perfil asociado al correo autenticado.'
        : 'No se encontró el perfil del usuario autenticado.')
    }

    return matches[0]
  },

  updatePassword(dpi, { currentPassword, newPassword, twoFactorCode = null }) {
    const normalizedDpi = String(dpi ?? '').trim()
    if (!normalizedDpi) throw new Error('No fue posible identificar el DPI del usuario.')

    return httpClient(`/users/password/${encodeURIComponent(normalizedDpi)}`, {
      method: 'PATCH',
      body: {
        currentPassword,
        newPassword,
        twoFactorCode: twoFactorCode || null,
      },
    })
  },
}
