const roles = ['Abogada', 'Administrador']
export const clientRoutes = [
  { path: '/clientes', name: 'clientes', component: () => import('./pages/ClientsPage.vue'),
    meta: { title: 'Clientes — LegalAdministrator', roles } },
  { path: '/clientes/nuevo', name: 'client-new', component: () => import('./pages/ClientEditorPage.vue'),
    meta: { title: 'Nuevo cliente — LegalAdministrator', roles } },
  { path: '/clientes/:dpi/editar', name: 'client-edit', component: () => import('./pages/ClientEditorPage.vue'),
    meta: { title: 'Datos del cliente — LegalAdministrator', roles } },
]
