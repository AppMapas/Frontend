import { defineStore } from 'pinia'
import { authApi } from '../services/authApi'

let twoFactorSetupRequestId = 0

function mapUser(response) {
  return {
    email: response.email,
    firstName: response.firstName,
    lastName: response.lastName,
    name: [response.firstName, response.lastName].filter(Boolean).join(' '),
    role: response.role,
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
  state: () => ({
    isAuthenticated: false,
    pending2FA: false,
    pendingEmail: null,
    user: null,
    accessToken: null,
    refreshToken: null,
    twoFactorEnabled: false,
    twoFactorSetup: null,
    isTwoFactorLoading: false,
    twoFactorError: null,
  }),

  actions: {
    setSession(response, twoFactorFallback = this.twoFactorEnabled) {
      if (!response?.accessToken || !response?.refreshToken) {
        throw new Error('El servidor no devolvió una sesión válida.')
      }

      this.user = mapUser(response)
      this.accessToken = response.accessToken
      this.refreshToken = response.refreshToken
      this.isAuthenticated = Boolean(response.accessToken)
      this.twoFactorEnabled = getTwoFactorStatus(response, twoFactorFallback)
      this.pending2FA = false
      this.pendingEmail = null
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

      const response = await authApi.verifyTwoFactor({
        email: this.pendingEmail,
        code,
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

    async beginTwoFactorSetup() {
      const requestId = ++twoFactorSetupRequestId
      this.twoFactorSetup = null
      this.twoFactorError = null
      this.isTwoFactorLoading = true

      try {
        const response = await authApi.setupTwoFactor()

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
        const response = await authApi.enableTwoFactor(normalizedCode)

        this.twoFactorEnabled = getTwoFactorStatus(response, true)
        this.twoFactorSetup = null

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
        const response = await authApi.disableTwoFactor(normalizedCode)

        this.twoFactorEnabled = getTwoFactorStatus(response, false)
        this.twoFactorSetup = null

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
      this.isAuthenticated = false
      this.pending2FA = false
      this.pendingEmail = null
      this.user = null
      this.accessToken = null
      this.refreshToken = null
      this.twoFactorEnabled = false
      this.cancelTwoFactorSetup()
    },
  },
})
