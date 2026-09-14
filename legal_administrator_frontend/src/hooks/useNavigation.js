import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import IconForm from '@/assets/icons/IconForm.vue'
import IconHistory from '@/assets/icons/IconHistory.vue'
import IconReport from '@/assets/icons/IconReport.vue'
import IconUsers from '@/assets/icons/IconUsers.vue'

export function useNavigation() {
  const route = useRoute()
  const isMobileMenuOpen = ref(false)

  const navItems = [
    {
      id: 'terrenos',
      path: '/terrenos',
      label: 'Terrenos',
      icon: IconForm,
      description: 'Cálculo de áreas y levantamiento'
    },
    {
      id: 'historial',
      path: '/historial',
      label: 'Historial',
      icon: IconHistory,
      description: 'Expedientes y registros previos'
    },
    {
      id: 'reportes',
      path: '/reportes',
      label: 'Reportes',
      icon: IconReport,
      description: 'Estadísticas e informes'
    },
    {
      id: 'clientes',
      path: '/clientes',
      label: 'Clientes',
      icon: IconUsers,
      description: 'Directorio y propietarios'
    }
  ]

  const activeSection = computed(() => {
    if (!route) return 'terrenos'
    const match = navItems.find(item => route.path.startsWith(item.path))
    return match ? match.id : 'terrenos'
  })

  const openMobileMenu = () => { isMobileMenuOpen.value = true }
  const closeMobileMenu = () => { isMobileMenuOpen.value = false }
  const toggleMobileMenu = () => { isMobileMenuOpen.value = !isMobileMenuOpen.value }

  return {
    navItems,
    activeSection,
    isMobileMenuOpen,
    openMobileMenu,
    closeMobileMenu,
    toggleMobileMenu
  }
}
