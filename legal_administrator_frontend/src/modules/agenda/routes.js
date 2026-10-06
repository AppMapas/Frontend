export const agendaRoutes = [
  {
    path: '/agenda',
    name: 'agenda',
    component: () => import('./pages/AgendaPage.vue'),
    meta: {
      roles: ['Abogada', 'Administrador'],
      title: 'Agenda — LegalAdministrator',
    },
  },
]
