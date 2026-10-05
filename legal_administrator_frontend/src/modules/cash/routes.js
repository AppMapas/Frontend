export const cashRoutes = [
  { path: '/caja', name: 'cash', component: () => import('./pages/CashPage.vue'),
    meta: { title: 'Caja — LegalAdministrator', roles: ['Abogada', 'Administrador'] } },
]
