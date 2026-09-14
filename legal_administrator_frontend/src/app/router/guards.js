import { useAuthStore } from '@/modules/auth/stores/authStore'

function getSafeRedirect(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/terrenos'
}

export function registerNavigationGuards(router, pinia) {
  router.beforeEach((to) => {
    const authStore = useAuthStore(pinia)
    const requiresAuth = to.matched.some((route) => route.meta.requiresAuth)
    const guestOnly = to.matched.some((route) => route.meta.guestOnly)

    if (requiresAuth && !authStore.isAuthenticated) {
      return {
        name: 'login',
        query: { redirect: to.fullPath },
      }
    }

    if (to.name === 'two-factor' && !authStore.pending2FA) {
      return { name: 'login' }
    }

    if (guestOnly && authStore.isAuthenticated) {
      return getSafeRedirect(to.query.redirect)
    }

    return true
  })
}
