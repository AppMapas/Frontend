/**
 * Cliente base de API para comunicación con el backend de Spring Boot (LegalAdministrator)
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

export async function apiClient(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Error en la petición: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`[API Error] ${endpoint}:`, error)
    throw error
  }
}
