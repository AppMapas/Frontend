import { ref, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/authStore'

export function useLeaveConfirmation(hasChanges, busy) {
  const auth = useAuthStore()
  const open = ref(false)
  let resolveNavigation = null
  function guard() {
    if (!auth.isAuthenticated) return true
    if (busy.value) return false
    if (!hasChanges.value) return true
    open.value = true
    return new Promise(resolve => { resolveNavigation = resolve })
  }
  function decide(leave) {
    open.value = false
    resolveNavigation?.(leave)
    resolveNavigation = null
  }
  onBeforeRouteLeave(guard)
  onBeforeRouteUpdate(guard)
  onBeforeUnmount(() => resolveNavigation?.(false))
  function beforeUnload(event) {
    if (!hasChanges.value || !auth.isAuthenticated) return
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', beforeUnload)
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
  return { open, decide }
}
