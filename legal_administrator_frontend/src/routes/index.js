import { createRouter, createWebHistory } from 'vue-router'

const TerrenosPage = () => import('@/pages/TerrenosPage.vue')
const HistorialPage = () => import('@/pages/HistorialPage.vue')
const ReportesPage = () => import('@/pages/ReportesPage.vue')
const ClientesPage = () => import('@/pages/ClientesPage.vue')
const PerfilPage = () => import('@/pages/PerfilPage.vue')
const NotFoundPage = () => import('@/pages/NotFoundPage.vue')

const routes = [
  {
    path: '/',
    redirect: '/terrenos'
  },
  {
    path: '/terrenos',
    name: 'terrenos',
    component: TerrenosPage,
    meta: { title: 'Terrenos — Cálculo de Áreas' }
  },
  {
    path: '/formulario',
    redirect: '/terrenos'
  },
  {
    path: '/historial',
    name: 'historial',
    component: HistorialPage,
    meta: { title: 'Historial de Expedientes — LegalAdministrator' }
  },
  {
    path: '/reportes',
    name: 'reportes',
    component: ReportesPage,
    meta: { title: 'Reportes y Estadísticas — LegalAdministrator' }
  },
  {
    path: '/clientes',
    name: 'clientes',
    component: ClientesPage,
    meta: { title: 'Directorio de Clientes — LegalAdministrator' }
  },
  {
    path: '/perfil',
    name: 'perfil',
    component: PerfilPage,
    meta: { title: 'Perfil de Administrador — LegalAdministrator' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
    meta: { title: 'Página no encontrada — LegalAdministrator' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  linkActiveClass: 'is-active',
  linkExactActiveClass: 'is-exact-active',
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title
  }
})

export default router
