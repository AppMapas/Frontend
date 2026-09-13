import { computed } from 'vue'
import { useAuthStore } from '@/modules/auth/stores/authStore'

export function useCurrentUser() {
  const authStore = useAuthStore()
  const currentUser = computed(() => ({
    name: authStore.user?.name || 'Usuario',
    role: authStore.user?.role || '',
    email: authStore.user?.email || '',
    avatarBg: 'var(--color-avatar-bg)',
  }))

  return {
    currentUser
  }
}
