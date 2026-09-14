import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './app/router'
import { registerNavigationGuards } from './app/router/guards'
import { useAuthStore } from './modules/auth/stores/authStore'
import { configureHttpClientAuth } from './shared/api/httpClient'
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

const authStore = useAuthStore(pinia)

configureHttpClientAuth({
  getAccessToken: () => authStore.accessToken,
  canRefresh: () => Boolean(authStore.refreshToken),
  refreshSession: () => authStore.refreshSession(),
  logout: () => {
    const currentRoute = router.currentRoute.value
    const wasPrivateRoute = currentRoute.matched.some((route) => route.meta.requiresAuth)

    authStore.logout()

    if (wasPrivateRoute) {
      router.replace({
        name: 'login',
        query: { redirect: currentRoute.fullPath },
      })
    }
  },
})

registerNavigationGuards(router, pinia)
app.use(router)

app.mount('#app')
