import { dashboardRoutes } from '@/modules/dashboard/routes.js'
import { defaultHome } from '@/shared/auth/homeRedirect.js'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import { createRouter, createWebHistory } from 'vue-router'
import { authRoutes } from '@/modules/auth/routes'
import { landingRoutes } from '@/modules/landing/routes'
import { terrainRoutes } from '@/modules/terrenos/routes'
import { processCatalogRoutes } from '@/modules/processes/routes'
import { legalProcessRoutes } from '@/modules/processes/legalProcessRoutes'
import { agendaRoutes } from '@/modules/agenda/routes'
import { cashRoutes } from '@/modules/cash/routes'
import { clientRoutes } from '@/modules/users/routes'

const PrivateLayout = () => import('@/app/layouts/PrivateLayout.vue')
const HistorialPage = () => import('@/pages/HistorialPage.vue')
const ReportesPage = () => import('@/pages/ReportesPage.vue')
const PerfilPage = () => import('@/pages/PerfilPage.vue')
const NotFoundPage = () => import('@/pages/NotFoundPage.vue')

const routes = [
  ...landingRoutes,
  ...authRoutes,
  {
    path: '/app',
    component: PrivateLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: () => defaultHome(useAuthStore().user?.role),
      },
      ...dashboardRoutes,
      ...terrainRoutes,
      ...processCatalogRoutes,
      ...legalProcessRoutes,
      ...clientRoutes,
      ...cashRoutes,
      ...agendaRoutes,
      {
        path: '/formulario',
        redirect: '/terrenos',
      },
      {
        path: '/historial',
        name: 'historial',
        component: HistorialPage,
        meta: { title: 'Historial de Expedientes — LegalAdministrator' },
      },
      {
        path: '/reportes',
        name: 'reportes',
        component: ReportesPage,
        meta: { title: 'Reportes y Estadísticas — LegalAdministrator' },
      },
      {
        path: '/perfil',
        name: 'perfil',
        component: PerfilPage,
        meta: { title: 'Perfil de Administrador — LegalAdministrator' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
    meta: { title: 'Página no encontrada — LegalAdministrator' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  linkActiveClass: 'is-active',
  linkExactActiveClass: 'is-exact-active',
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }

    return { top: 0 }
  },
})

router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title
  }
})

export default router
