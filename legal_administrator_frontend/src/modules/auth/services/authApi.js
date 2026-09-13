import { httpClient } from '@/shared/api/httpClient'

const AUTH_ENDPOINT = '/auth'

export const authApi = {
  login(credentials) {
    return httpClient(`${AUTH_ENDPOINT}/login`, {
      method: 'POST',
      body: credentials,
      skipAuth: true,
      retryOnUnauthorized: false,
    })
  },

  verifyTwoFactor(payload) {
    return httpClient(`${AUTH_ENDPOINT}/2fa/verify`, {
      method: 'POST',
      body: payload,
      skipAuth: true,
      retryOnUnauthorized: false,
    })
  },

  setupTwoFactor() {
    return httpClient(`${AUTH_ENDPOINT}/2fa/setup`, {
      method: 'POST',
    })
  },

  enableTwoFactor(code) {
    return httpClient(`${AUTH_ENDPOINT}/2fa/enable`, {
      method: 'POST',
      body: { code },
    })
  },

  disableTwoFactor(code) {
    return httpClient(`${AUTH_ENDPOINT}/2fa/disable`, {
      method: 'POST',
      body: { code },
    })
  },

  refresh(refreshToken) {
    return httpClient(`${AUTH_ENDPOINT}/refresh`, {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
      retryOnUnauthorized: false,
    })
  },
}
