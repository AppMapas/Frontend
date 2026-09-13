const AuthLayout = () => import('@/app/layouts/AuthLayout.vue')
const LoginPage = () => import('./pages/LoginPage.vue')
const TwoFactorPage = () => import('./pages/TwoFactorPage.vue')

export const authRoutes = [
  {
    path: '/auth',
    component: AuthLayout,
    meta: { public: true, guestOnly: true },
    children: [
      {
        path: '',
        redirect: { name: 'login' },
      },
      {
        path: '/login',
        name: 'login',
        component: LoginPage,
        meta: { title: 'Iniciar sesión — LegalAdministrator' },
      },
      {
        path: '/verificacion',
        name: 'two-factor',
        component: TwoFactorPage,
        meta: { title: 'Verificación de seguridad — LegalAdministrator' },
      },
    ],
  },
]
