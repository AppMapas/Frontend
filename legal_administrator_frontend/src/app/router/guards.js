import { loginRedirect } from '@/shared/auth/homeRedirect.js'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'

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
      useNotificationStore(pinia).show('Tu perfil no tiene acceso a esta sección.', 'warning')
      return { path: '/terrenos' }
    }

    if (guestOnly && authStore.isAuthenticated) {
      return loginRedirect(to.query.redirect, authStore.user?.role)
    }

    return true
  })
}
