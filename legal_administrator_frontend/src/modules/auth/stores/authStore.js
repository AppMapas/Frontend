import { defineStore } from 'pinia'
import { useAgendaSubmissionStore } from '@/modules/agenda/stores/agendaSubmissionStore.js'
import { useAgendaStore } from '@/modules/agenda/stores/agendaStore.js'
import { clearPersistedAuthSession, mapAuthUser, persistAuthSession, readPersistedAuthSession } from '@/shared/auth/authSessionStorage'
import { usersApi } from '@/modules/users/services/usersApi'
import { authApi } from '../services/authApi'

let twoFactorSetupRequestId = 0

function getTokenSubject(token) {
  if (typeof atob !== 'function' || typeof token !== 'string') return ''
  try {
    const encodedPayload = token.split('.')[1]
    if (!encodedPayload) return ''
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    return typeof payload.sub === 'string' ? payload.sub.trim() : ''
  } catch {
    return ''
  }
}

function getTwoFactorStatus(response, fallback = false) {
  const status = response?.twoFactorEnabled ?? response?.enabled
  return typeof status === 'boolean' ? status : fallback
}

function validateTwoFactorCode(code) {
  const normalizedCode = String(code ?? '').trim()

  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new Error('Ingresa un código de autenticación válido de 6 dígitos.')
  }

  return normalizedCode
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    const persisted = readPersistedAuthSession()
    return {
      isAuthenticated: Boolean(persisted),
      pending2FA: false,
      pendingEmail: null,
      user: persisted?.user ?? null,
      accessToken: persisted?.accessToken ?? null,
      refreshToken: persisted?.refreshToken ?? null,
      twoFactorEnabled: persisted?.twoFactorEnabled ?? false,
      twoFactorSetup: null,
      isTwoFactorLoading: false,
      twoFactorError: null,
      profileRequestId: 0,
      isProfileLoading: false,
      profileError: null,
    }
  },

  actions: {
    setSession(response, twoFactorFallback = this.twoFactorEnabled) {
      if (!response?.accessToken || !response?.refreshToken) {
        throw new Error('El servidor no devolvió una sesión válida.')
      }

      if (this.user?.email !== response.email) {
        this.profileRequestId += 1
        this.isProfileLoading = false
        this.profileError = null
      }
      this.user = mapAuthUser(response, this.user)
      this.accessToken = response.accessToken
      this.refreshToken = response.refreshToken
      this.isAuthenticated = Boolean(response.accessToken)
      this.twoFactorEnabled = getTwoFactorStatus(response, twoFactorFallback)
      this.pending2FA = false
      this.pendingEmail = null
      this.persistSession()
    },

    persistSession() {
      persistAuthSession({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        user: this.user,
        twoFactorEnabled: this.twoFactorEnabled,
      })
    },

    async login(credentials) {
      this.cancelTwoFactor()
      this.cancelTwoFactorSetup()
      const response = await authApi.login(credentials)

      if (response.twoFactorRequired) {
        this.logout()
        this.pending2FA = true
        this.pendingEmail = response.email || credentials.email

        return { requiresTwoFactor: true }
      }

      this.setSession(response, false)
      return { requiresTwoFactor: false }
    },

    async verifyTwoFactor(code) {
      if (!this.pending2FA || !this.pendingEmail) {
        throw new Error('No existe una verificación en dos pasos pendiente.')
      }

      const normalizedCode = validateTwoFactorCode(code)
      const response = await authApi.verifyTwoFactor({
        email: this.pendingEmail,
        code: normalizedCode,
      })

      this.setSession(response, true)
      return response
    },

    async refreshSession() {
      if (!this.refreshToken) {
        throw new Error('No existe un token de renovación disponible.')
      }

      try {
        const response = await authApi.refresh(this.refreshToken)
        this.setSession(response)
        return response.accessToken
      } catch (error) {
        this.logout()
        throw error
      }
    },

    async loadCurrentUser() {
      if (!this.accessToken) throw new Error('No existe una sesión autenticada.')

      const requestId = ++this.profileRequestId
      const authenticatedEmail = getTokenSubject(this.accessToken) || this.user?.email
      const stillCurrent = () => requestId === this.profileRequestId
        && this.isAuthenticated
        && (getTokenSubject(this.accessToken) || this.user?.email) === authenticatedEmail

      this.isProfileLoading = true
      this.profileError = null
      try {
        const response = await usersApi.getCurrentByEmail(authenticatedEmail)
        if (!stillCurrent()) return null
        if (!response?.dpi) throw new Error('El servidor no confirmó el DPI de la cuenta autenticada.')
        this.user = mapAuthUser(response)
        this.twoFactorEnabled = getTwoFactorStatus(response, this.twoFactorEnabled)
        this.persistSession()
        return this.user
      } catch (error) {
        if (!stillCurrent()) return null
        this.profileError = error?.message || 'No fue posible cargar el perfil del usuario.'
        throw error
      } finally {
        if (requestId === this.profileRequestId) this.isProfileLoading = false
      }
    },

    async updatePassword({ currentPassword, newPassword, twoFactorCode = '' }) {
      if (!this.user?.dpi) await this.loadCurrentUser()
      return usersApi.updatePassword(this.user?.dpi, {
        currentPassword,
        newPassword,
        twoFactorCode: this.twoFactorEnabled ? validateTwoFactorCode(twoFactorCode) : null,
      })
    },

    async beginTwoFactorSetup() {
      if (!this.user?.email) {
        const error = new Error('No fue posible identificar la cuenta para configurar 2FA.')
        this.twoFactorError = error.message
        throw error
      }

      const requestId = ++twoFactorSetupRequestId
      this.twoFactorSetup = null
      this.twoFactorError = null
      this.isTwoFactorLoading = true

      try {
        const response = await authApi.setupTwoFactor(this.user.email)

        if (requestId !== twoFactorSetupRequestId) return null

        if (!response?.qrCodeUri || !response?.manualEntryKey) {
          throw new Error('El servidor no devolvió una configuración 2FA válida.')
        }

        this.twoFactorSetup = {
          secret: response?.secret ?? null,
          qrCodeUri: response.qrCodeUri,
          manualEntryKey: response.manualEntryKey,
        }

        return this.twoFactorSetup
      } catch (error) {
        if (requestId === twoFactorSetupRequestId) {
          this.twoFactorError = error?.message || 'No fue posible iniciar la configuración de 2FA.'
        }
        throw error
      } finally {
        if (requestId === twoFactorSetupRequestId) {
          this.isTwoFactorLoading = false
        }
      }
    },

    async confirmTwoFactorSetup(code) {
      this.twoFactorError = null
      this.isTwoFactorLoading = true

      try {
        const normalizedCode = validateTwoFactorCode(code)
        const response = await authApi.enableTwoFactor(normalizedCode, this.user?.email)

        this.twoFactorEnabled = getTwoFactorStatus(response, true)
        this.twoFactorSetup = null
        this.persistSession()

        return response
      } catch (error) {
        this.twoFactorError = error?.message || 'No fue posible activar la autenticación en dos pasos.'
        throw error
      } finally {
        this.isTwoFactorLoading = false
      }
    },

    async disableTwoFactor(code) {
      this.twoFactorError = null
      this.isTwoFactorLoading = true

      try {
        const normalizedCode = validateTwoFactorCode(code)
        const response = await authApi.disableTwoFactor(normalizedCode, this.user?.email)

        this.twoFactorEnabled = getTwoFactorStatus(response, false)
        this.twoFactorSetup = null
        this.persistSession()

        return response
      } catch (error) {
        this.twoFactorError = error?.message || 'No fue posible desactivar la autenticación en dos pasos.'
        throw error
      } finally {
        this.isTwoFactorLoading = false
      }
    },

    cancelTwoFactorSetup() {
      twoFactorSetupRequestId += 1
      this.twoFactorSetup = null
      this.twoFactorError = null
      this.isTwoFactorLoading = false
    },

    cancelTwoFactor() {
      this.pending2FA = false
      this.pendingEmail = null
    },

    logout() {
      useAgendaSubmissionStore().reset()
      useAgendaStore().reset()
      this.profileRequestId += 1
      this.isProfileLoading = false
      this.isAuthenticated = false
      this.pending2FA = false
      this.pendingEmail = null
      this.user = null
      this.accessToken = null
      this.refreshToken = null
      this.twoFactorEnabled = false
      this.profileError = null
      this.cancelTwoFactorSetup()
      clearPersistedAuthSession()
    },
  },
})
