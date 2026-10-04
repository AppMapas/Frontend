export const processCatalogRoutes = [
  {
    path: '/tramites',
    name: 'process-types',
    component: () => import('./pages/ProcessTypesPage.vue'),
    meta: { title: 'Trámites — LegalAdministrator' },
  },
  {
    path: '/tramites/nuevo',
    name: 'process-type-new',
    component: () => import('./pages/ProcessTypeEditorPage.vue'),
    meta: { title: 'Nuevo trámite — LegalAdministrator' },
  },
  {
    path: '/tramites/:id/editar',
    name: 'process-type-edit',
    component: () => import('./pages/ProcessTypeEditorPage.vue'),
    meta: { title: 'Editar trámite — LegalAdministrator' },
  },
  {
    path: '/tramites/:id/etapas',
    name: 'process-type-stages',
    component: () => import('./pages/ProcessStagesPage.vue'),
    meta: { title: 'Etapas del trámite — LegalAdministrator' },
  },
  {
    path: '/requisitos',
    name: 'requirements',
    component: () => import('./pages/RequirementsPage.vue'),
    meta: { title: 'Requisitos — LegalAdministrator' },
  },
]
