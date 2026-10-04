import { ref } from 'vue'

export function usePagedResource(fetchPage) {
  const items = ref([])
  const loading = ref(false)
  const failed = ref(false)
  const totalElements = ref(0)
  const totalPages = ref(0)
  let requestNumber = 0
  let controller = null

  function reset() {
    requestNumber += 1
    controller?.abort()
    items.value = []
    loading.value = false
    failed.value = false
    totalElements.value = 0
    totalPages.value = 0
  }

  async function load(filters) {
    controller?.abort()
    controller = new AbortController()
    const currentController = controller
    const currentRequest = ++requestNumber
    loading.value = true
    failed.value = false
    try {
      const response = await fetchPage(filters, { signal: currentController.signal })
      if (currentRequest !== requestNumber) return null
      items.value = response.content
      totalElements.value = response.totalElements
      totalPages.value = response.totalPages
      return response
    } catch (error) {
      if (currentRequest !== requestNumber || currentController.signal.aborted) return null
      failed.value = true
      throw error
    } finally {
      if (currentRequest === requestNumber) loading.value = false
    }
  }
  return { items, loading, failed, totalElements, totalPages, load, reset }
}
