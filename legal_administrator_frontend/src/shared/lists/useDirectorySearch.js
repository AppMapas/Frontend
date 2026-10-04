import { onBeforeUnmount, onMounted, watch } from 'vue'
import { notifyRequestError } from '../forms/requestFeedback.js'

export function useDirectorySearch(filters, resource) {
  let timer = null
  let alive = true

  async function refresh() {
    if (!alive) return
    window.clearTimeout(timer)
    try {
      const result = await resource.load({ ...filters })
      if (alive && result && filters.page > 0
          && filters.page >= resource.totalPages) {
        filters.page = Math.max(0, resource.totalPages - 1)
      }
    } catch (error) {
      if (alive) notifyRequestError(error, 'No fue posible cargar la lista.', 'Reintentar', refresh)
    }
  }

  watch(() => ({ ...filters }), (current, previous) => {
    const filtersChanged = Object.keys(current).some(key =>
      key !== 'page' && key !== 'size' && current[key] !== previous[key])
    if (filtersChanged && filters.page !== 0) filters.page = 0
    window.clearTimeout(timer)
    timer = window.setTimeout(refresh, 300)
  })
  onMounted(refresh)
  onBeforeUnmount(() => {
    alive = false
    window.clearTimeout(timer)
    resource.reset()
  })
  return { refresh }
}
