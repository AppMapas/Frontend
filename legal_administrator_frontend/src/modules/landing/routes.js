const PublicLayout = () => import('@/app/layouts/PublicLayout.vue')
const LandingPage = () => import('./pages/LandingPage.vue')

export const landingRoutes = [
  {
    path: '/',
    component: PublicLayout,
    children: [
      {
        path: '',
        name: 'landing',
        component: LandingPage,
        meta: {
          public: true,
          title: 'Licda. Azucely Loayes | Abogada y Notaria',
        },
      },
    ],
  },
]
