<script setup>
import { RouterView } from 'vue-router'
import AppNavbar from '@/components/navigation/AppNavbar.vue'
import { computed, onBeforeUnmount, watch } from 'vue'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import { useRoute } from 'vue-router'
import FloatingNotifications from '@/components/common/FloatingNotifications.vue'
import { useClientStore } from '@/modules/users/stores/clientStore.js'
import { useLegalProcessStore } from '@/modules/processes/stores/legalProcessStore.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'

import { useCashStore } from '@/modules/cash/stores/cashStore.js'
import { useFinancialSubmissionStore } from '@/shared/finance/financialSubmissionStore.js'

const cash = useCashStore()
const submission = useFinancialSubmissionStore()
const clients = useClientStore()
const cases = useLegalProcessStore()
const notifications = useNotificationStore()
const route = useRoute()
const auth = useAuthStore()
let active = true
async function loadFinancialProfile() {
  if (!active || !auth.isAuthenticated || auth.user?.dpi || auth.isProfileLoading) return
  if (!['Abogada', 'Administrador'].includes(auth.user?.role)) return
  const email = auth.user?.email
  try {
    await auth.loadCurrentUser()
  } catch (error) {
    if (active && auth.isAuthenticated && auth.user?.email === email) {
      notifyRequestError(error, 'No fue posible identificar tu cuenta para registrar movimientos.', 'Reintentar', loadFinancialProfile)
    }
  }
}
watch(() => [auth.user?.email, auth.user?.role], loadFinancialProfile, { immediate: true })
watch(() => auth.user?.dpi, (actor, previous) => {
  if (previous && actor !== previous) {
    cash.reset()
    submission.resetSession()
  }
  if (actor) submission.restoreSession(actor)
}, { flush: 'sync', immediate: true })
const userName = computed(() => auth.user?.name
  || [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(' ') || 'Mi cuenta')
watch(() => route.fullPath, () => {
  if (notifications.current) {
    notifications.current.action = null
    notifications.current.actionLabel = ''
  }
})
onBeforeUnmount(() => {
  active = false
  clients.resetSession()
  cases.resetSession()
  notifications.close()
  cash.reset()
  submission.resetSession()
})
</script>

<template>
  <div class="layout-container">
    <!-- Navbar principal -->
    <AppNavbar :user-name="userName" />
    <FloatingNotifications />

    <!-- Contenido dinámico de las páginas -->
    <main class="main-content">
      <div class="content-wrapper">
        <RouterView />
      </div>
    </main>

    <!-- Footer global -->
    <footer class="app-footer">
      <div class="footer-inner">
        <p class="footer-copy">
          &copy; {{ new Date().getFullYear() }} <strong>LegalAdministrator</strong> — Plataforma de Gestión Jurídica y Topográfica.
        </p>
        <p class="footer-meta">
          Seminario de Sistemas 1 · Versión 1.0.0
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.layout-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-body);
}

.main-content {
  flex: 1;
  padding: 0 1.25rem 2rem 1.25rem;
  box-sizing: border-box;
}

.content-wrapper {
  background-color: var(--color-bg-card);
  border-bottom-left-radius: var(--radius-lg);
  border-bottom-right-radius: var(--radius-lg);
  border: 1px solid var(--color-border-subtle);
  border-top: none;
  padding: 2rem;
  min-height: calc(100vh - 180px);
  box-shadow: var(--shadow-sm);
}

.app-footer {
  margin-top: auto;
  padding: 1.5rem 1.25rem 2rem;
  border-top: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: var(--max-content-width);
  margin: 0 auto;
  font-size: 0.8125rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.footer-meta {
  font-family: var(--font-mono);
  color: var(--color-teal);
  font-size: 0.75rem;
}

@media (max-width: 860px) {
  .main-content {
    padding: 0 0.75rem 1.5rem 0.75rem;
  }
  .content-wrapper {
    padding: 1.25rem;
  }
  .footer-inner {
    flex-direction: column;
    text-align: center;
    align-items: center;
  }
}

@media (max-width: 640px) {
  .main-content {
    padding: 0 0.5rem 1rem 0.5rem;
  }
  .content-wrapper {
    padding: 1rem;
    border-radius: var(--radius-md);
  }
}
</style>
