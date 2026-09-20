import { interceptAuthResponse } from '../auth/authSessionStorage.js'

const DEFAULT_API_URL = 'http://localhost:8080/api/v1'

export const API_BASE_URL = (import.meta.env?.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')

let authHandlers = {
  getAccessToken: () => null,
  canRefresh: () => false,
  refreshSession: null,
  logout: null,
}
let refreshRequest = null

export function configureHttpClientAuth(handlers = {}) {
  authHandlers = {
    ...authHandlers,
    ...handlers,
  }
}

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function buildUrl(endpoint) {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${API_BASE_URL}${normalizedEndpoint}`
}

function hasJsonBody(body) {
  return body !== null
    && typeof body === 'object'
    && !(body instanceof FormData)
    && !(body instanceof URLSearchParams)
    && !(body instanceof Blob)
}

async function parseResponse(response, responseType) {
  if (response.status === 204) return null

  // Los errores se interpretan como JSON/texto incluso al descargar archivos.
  if (response.ok && responseType === 'blob') return response.blob()

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try {
      return await response.json()
    } catch (cause) {
      throw new ApiError('El servidor devolvió una respuesta JSON inválida.', {
        status: response.status,
        cause,
      })
    }
  }

  const text = await response.text()
  return text || null
}

async function renewSession() {
  if (!authHandlers.refreshSession || !authHandlers.canRefresh()) {
    authHandlers.logout?.()
    return false
  }

  if (!refreshRequest) {
    refreshRequest = Promise.resolve().then(() => authHandlers.refreshSession())
      .then(() => true)
      .catch(() => {
        authHandlers.logout?.()
        return false
      })
      .finally(() => {
        refreshRequest = null
      })
  }

  return refreshRequest
}

export async function httpClient(endpoint, options = {}) {
  const {
    body,
    headers: customHeaders,
    skipAuth = false,
    retryOnUnauthorized = true,
    responseType,
    ...requestOptions
  } = options
  const isJsonBody = hasJsonBody(body)
  const headers = new Headers(customHeaders)

  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  if (isJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const accessToken = authHandlers.getAccessToken()

  if (!skipAuth && accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  try {
    const response = await fetch(buildUrl(endpoint), {
      ...requestOptions,
      headers,
      body: isJsonBody ? JSON.stringify(body) : body,
    })
    if (response.status === 401 && !skipAuth && retryOnUnauthorized) {
      const renewed = await renewSession()

      if (renewed) {
        return httpClient(endpoint, {
          ...options,
          retryOnUnauthorized: false,
        })
      }
    } else if (response.status === 401 && !skipAuth) {
      authHandlers.logout?.()
    }

    const data = await parseResponse(response, responseType)

    if (!response.ok) {
      const message = typeof data?.message === 'string' && data.message.trim()
        ? data.message
        : `La solicitud falló con estado ${response.status}`
      throw new ApiError(message, { status: response.status, data })
    }

    interceptAuthResponse(data)
    return data
  } catch (error) {
    if (error instanceof ApiError) throw error

    throw new ApiError('No fue posible conectar con el servidor.', {
      cause: error,
    })
  }
}

export default httpClient
