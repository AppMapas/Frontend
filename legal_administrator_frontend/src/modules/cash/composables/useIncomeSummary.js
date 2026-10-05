import { ref } from 'vue'
import { cashApi } from '../services/cashApi.js'

/** La selección vigente es la única que puede publicar un resumen financiero. */
export function useIncomeSummary() {
  const summary = ref(null)
  const loading = ref(false)
  const failed = ref(false)
  let sequence = 0
  let controller = null

  function reset() {
    sequence += 1
    controller?.abort()
    summary.value = null
    loading.value = false
    failed.value = false
  }

  async function load(caseId) {
    reset()
    const current = sequence
    const requestController = new AbortController()
    controller = requestController
    loading.value = true
    try {
      const result = await cashApi.incomeSummary(caseId, { signal: requestController.signal })
      if (current !== sequence) return null
      summary.value = result
      return result
    } catch (error) {
      if (current !== sequence || requestController.signal.aborted) return null
      failed.value = true
      throw error
    } finally {
      if (current === sequence) loading.value = false
    }
  }

  return { summary, loading, failed, load, reset }
}
