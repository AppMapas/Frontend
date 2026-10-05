import { ref } from 'vue'
import { defineStore } from 'pinia'
import { cashApi } from '../services/cashApi.js'

export const useCashStore = defineStore('cash', () => {
  const items = ref([])
  const summary = ref(null)
  const loading = ref(false)
  const failed = ref(false)
  const totalElements = ref(0)
  const totalPages = ref(0)
  let controller = null
  let sequence = 0
  function reset() {
    sequence += 1
    controller?.abort()
    items.value = []
    summary.value = null
    totalElements.value = 0
    totalPages.value = 0
    loading.value = false
    failed.value = false
  }
  async function load(filters) {
    controller?.abort()
    controller = new AbortController()
    const current = ++sequence
    loading.value = true
    failed.value = false
    try {
      const result = await cashApi.overview(filters, { signal: controller.signal })
      if (current !== sequence) return null
      items.value = result.movements.content
      summary.value = result.summary
      totalElements.value = result.movements.totalElements
      totalPages.value = result.movements.totalPages
      return result
    } catch (error) {
      if (current !== sequence || controller.signal.aborted) return null
      failed.value = true
      summary.value = null
      throw error
    } finally {
      if (current === sequence) loading.value = false
    }
  }
  return { items, summary, loading, failed, totalElements, totalPages, load, reset }
})
