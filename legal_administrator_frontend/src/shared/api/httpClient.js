const DEFAULT_API_URL = 'http://localhost:8080/api/v1'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')

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

async function parseResponse(response) {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
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
    refreshRequest = Promise.resolve(authHandlers.refreshSession())
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
    ...requestOptions
  } = options
  const isJsonBody = hasJsonBody(body)
  const headers = new Headers(customHeaders)

  headers.set('Accept', 'application/json')

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
    const data = await parseResponse(response)

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

    if (!response.ok) {
      const message = data?.message || `La solicitud falló con estado ${response.status}`
      throw new ApiError(message, { status: response.status, data })
    }

    return data
  } catch (error) {
    if (error instanceof ApiError) throw error

    throw new ApiError('No fue posible conectar con el servidor.', {
      cause: error,
    })
  }
}

export default httpClient
