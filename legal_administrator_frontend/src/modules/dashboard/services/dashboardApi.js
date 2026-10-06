import { httpClient } from '../../../shared/api/httpClient.js'
export const dashboardApi = {
  summary: (options = {}) => httpClient('/dashboard/summary', options),
  reminders: (filters = {}, options = {}) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== '' && value !== null && value !== undefined) {
        params.set(key, String(value))
      }
    }
    return httpClient(`/dashboard/reminders?${params}`, options)
  },
}
