const roles = ['Abogada', 'Administrador']
export const legalProcessRoutes = [
  { path: '/expedientes', name: 'legal-processes', component: () => import('./pages/LegalProcessesPage.vue'),
    meta: { title: 'Expedientes — LegalAdministrator', roles } },
  { path: '/expedientes/nuevo', name: 'legal-process-new', component: () => import('./pages/NewLegalProcessPage.vue'),
    meta: { title: 'Abrir expediente — LegalAdministrator', roles } },
  { path: '/expedientes/:id', name: 'legal-process-detail', component: () => import('./pages/LegalProcessDetailPage.vue'),
    meta: { title: 'Detalle de expediente — LegalAdministrator', roles } },
]
