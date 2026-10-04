import { useAuthStore } from '@/modules/auth/stores/authStore'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'

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

    const permittedRoles = to.meta.roles
    if (requiresAuth && permittedRoles && !permittedRoles.includes(authStore.user?.role)) {
      useNotificationStore(pinia).show('Tu perfil no tiene acceso a la gestión de clientes y expedientes.', 'warning')
      return { path: '/terrenos' }
    }

    if (guestOnly && authStore.isAuthenticated) {
      return getSafeRedirect(to.query.redirect)
    }

    return true
  })
}
