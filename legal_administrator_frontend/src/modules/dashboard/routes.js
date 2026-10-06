export const dashboardRoutes = [
  {
    path: '/inicio',
    name: 'dashboard',
    component: () => import('./pages/DashboardPage.vue'),
    meta: { title: 'Inicio — LegalAdministrator', roles: ['Abogada', 'Administrador'] },
  },
]
