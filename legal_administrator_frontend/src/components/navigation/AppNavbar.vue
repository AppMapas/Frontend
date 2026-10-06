<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import NavLink from './NavLink.vue'
import UserProfileBadge from './UserProfileBadge.vue'
import IconLogo from '@/assets/icons/IconLogo.vue'
import IconMenu from '@/assets/icons/IconMenu.vue'
import IconClose from '@/assets/icons/IconClose.vue'
import IconForm from '@/assets/icons/IconForm.vue'
import IconHistory from '@/assets/icons/IconHistory.vue'
import IconReport from '@/assets/icons/IconReport.vue'
import IconUsers from '@/assets/icons/IconUsers.vue'
import IconChecklist from '@/assets/icons/IconChecklist.vue'
import { useAuthStore } from '@/modules/auth/stores/authStore'

const props = defineProps({
  brandName: {
    type: String,
    default: 'LegalAdministrator'
  },
  navItems: {
    type: Array,
    default: () => [
      { path: '/inicio', label: 'Inicio', icon: IconReport, roles: ['Abogada', 'Administrador'] },
      { path: '/terrenos', label: 'Terrenos', icon: IconForm },
      { path: '/historial', label: 'Historial', icon: IconHistory },
      { path: '/reportes', label: 'Reportes', icon: IconReport },
      { path: '/clientes', label: 'Clientes', icon: IconUsers, roles: ['Abogada', 'Administrador'] },
      { path: '/expedientes', label: 'Expedientes', icon: IconHistory, roles: ['Abogada', 'Administrador'] },
      { path: '/agenda', label: 'Agenda', icon: IconChecklist, roles: ['Abogada', 'Administrador'] },
      { path: '/caja', label: 'Caja', icon: IconReport, roles: ['Abogada', 'Administrador'] },
      { path: '/tramites', label: 'Trámites', icon: IconChecklist }
    ]
  },
  userName: {
    type: String,
    default: 'Administrador'
  }
})

const route = useRoute()
const authStore = useAuthStore()
const visibleNavItems = computed(() => props.navItems.filter(item =>
  !item.roles || item.roles.includes(authStore.user?.role)))
const isMobileMenuOpen = ref(false)
const isDarkMode = ref(false)

const applyTheme = (isDark) => {
  isDarkMode.value = isDark
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  localStorage.setItem('legal-administrator-theme', isDark ? 'dark' : 'light')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#15211F' : '#F4F6F6')
}

const toggleTheme = () => {
  applyTheme(!isDarkMode.value)
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

// Cerrar drawer automáticamente al cambiar de ruta
watch(() => route.path, () => {
  closeMobileMenu()
})

onMounted(() => {
  const savedTheme = localStorage.getItem('legal-administrator-theme')
  applyTheme(savedTheme === 'dark')
})
</script>

<template>
  <header class="navbar-wrapper">
    <div class="navbar-inner">
      <!-- 1. Marca / Logo (según navvar.png) -->
      <RouterLink to="/" class="navbar-brand" aria-label="Ir al inicio de LegalAdministrator">
        <span class="brand-badge-icon">
          <IconLogo :size="20" color="#FFFFFF" />
        </span>
        <span class="brand-title">{{ brandName }}</span>
      </RouterLink>

      <!-- 2. Navegación Desktop -->
      <nav class="navbar-nav desktop-nav" aria-label="Navegación principal">
        <ul class="nav-list">
          <li v-for="item in visibleNavItems" :key="item.path" class="nav-item">
            <NavLink :to="item.path" :label="item.label" />
          </li>
        </ul>

        <!-- Separador vertical según navvar.png -->
        <span class="nav-divider" aria-hidden="true"></span>

        <!-- Badge de Usuario / Administrador según navvar.png -->
        <UserProfileBadge :user-name="userName" :is-dark-mode="isDarkMode" @toggle-theme="toggleTheme" />
      </nav>

      <!-- 3. Botón menú mobile (Hamburguesa) -->
      <button
        type="button"
        class="mobile-toggle-btn"
        :aria-expanded="isMobileMenuOpen"
        aria-controls="mobile-drawer"
        aria-label="Abrir menú de navegación"
        @click="toggleMobileMenu"
      >
        <IconMenu v-if="!isMobileMenuOpen" :size="24" />
        <IconClose v-else :size="24" />
      </button>
    </div>

    <!-- 4. Drawer de navegación Mobile & Overlay -->
    <transition name="drawer-fade">
      <div
        v-if="isMobileMenuOpen"
        class="mobile-backdrop"
        @click="closeMobileMenu"
        aria-hidden="true"
      ></div>
    </transition>

    <transition name="drawer-slide">
      <aside
        v-if="isMobileMenuOpen"
        id="mobile-drawer"
        class="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menú móvil"
      >
        <div class="drawer-header">
          <div class="drawer-brand">
            <span class="brand-badge-icon">
              <IconLogo :size="18" color="#FFFFFF" />
            </span>
            <span class="drawer-title">{{ brandName }}</span>
          </div>
          <button
            type="button"
            class="drawer-close-btn"
            aria-label="Cerrar menú"
            @click="closeMobileMenu"
          >
            <IconClose :size="20" />
          </button>
        </div>

        <div class="drawer-user-card">
          <UserProfileBadge :user-name="userName" />
        </div>

        <button
          type="button"
          class="theme-toggle theme-toggle-mobile"
          :aria-label="isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          :aria-pressed="isDarkMode"
          @click="toggleTheme"
        >
          <span class="theme-toggle-icon" aria-hidden="true">{{ isDarkMode ? '☀' : '☾' }}</span>
          <span>{{ isDarkMode ? 'Modo claro' : 'Modo oscuro' }}</span>
        </button>

        <nav class="drawer-nav" aria-label="Navegación móvil">
          <ul class="drawer-list">
            <li v-for="item in visibleNavItems" :key="item.path">
              <NavLink :to="item.path" :label="item.label" :is-mobile="true">
                <template #icon>
                  <component :is="item.icon" :size="20" />
                </template>
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
    </transition>
  </header>
</template>

<style scoped>
/* ==========================================================================
   ESTRUCTURA DEL NAVBAR (Fiel a navvar.png)
   ========================================================================== */
.navbar-wrapper {
  width: 100%;
  background-color: var(--color-bg-body);
  padding: 0.85rem 1.25rem 0 1.25rem;
  box-sizing: border-box;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.navbar-inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-bg-card);
  border-top-left-radius: var(--radius-lg);
  border-top-right-radius: var(--radius-lg);
  box-shadow: var(--shadow-navbar);
  border: 1px solid var(--color-border-subtle);
  border-bottom: none;
  padding: 0.75rem 1.75rem;
  min-height: 64px;
}

/* Línea superior de identidad teal. */
.navbar-inner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-top-left-radius: var(--radius-lg);
  border-top-right-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--color-coral-decorative) 0%, var(--color-deep-teal) 24%, var(--color-sage) 55%, var(--color-teal) 78%, var(--color-teal-dark) 100%);
}

/* Marca / Logo */
.navbar-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  cursor: pointer;
}

.navbar-brand:focus-visible {
  outline: 2px solid var(--color-teal);
  outline-offset: 4px;
  border-radius: var(--radius-sm);
}

/* Badge de marca con degradado teal y contraste alto. */
.brand-badge-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, var(--color-deep-teal) 0%, var(--color-teal-darker) 100%);
  color: #FFFFFF;
  border-radius: var(--radius-sm);
  box-shadow: 0 3px 8px rgba(50, 107, 114, 0.32);
  flex-shrink: 0;
}

.brand-pill-badge {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  background: rgba(90, 155, 149, 0.12);
  color: var(--color-teal-strong);
  border: 1px solid rgba(90, 155, 149, 0.35);
  letter-spacing: 0.02em;
}

@media (max-width: 640px) {
  .brand-pill-badge {
    display: none;
  }
}

.brand-title {
  font-family: var(--font-sans);
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text-title);
  letter-spacing: -0.02em;
}

/* Navegación Desktop */
.desktop-nav {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.nav-list {
  display: flex;
  align-items: center;
  list-style: none;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
}

/* Separador vertical según navvar.png */
.nav-divider {
  display: inline-block;
  width: 1px;
  height: 22px;
  background-color: var(--color-divider);
  margin: 0 0.5rem;
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background-color var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.theme-toggle:hover {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-title);
  border-color: var(--color-border-medium);
}

.theme-toggle-icon {
  color: var(--color-teal);
  font-size: 1rem;
  line-height: 1;
}

/* Botón Hamburguesa Mobile */
.mobile-toggle-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  color: var(--color-text-title);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.mobile-toggle-btn:hover {
  background-color: var(--color-bg-subtle);
}

.mobile-toggle-btn:focus-visible {
  outline: 2px solid var(--color-teal);
  outline-offset: 2px;
}

/* ==========================================================================
   MOBILE DRAWER & RESPONSIVE DESIGN
   ========================================================================== */
.mobile-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(30, 41, 39, 0.4);
  backdrop-filter: blur(3px);
  z-index: 1050;
}

.mobile-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(85vw, 320px);
  background-color: var(--color-bg-elevated);
  box-shadow: var(--shadow-lg);
  z-index: 1060;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  overflow-y: auto;
}

.theme-toggle-mobile {
  width: 100%;
  justify-content: flex-start;
  margin-bottom: 1rem;
  padding: 0.7rem 0.75rem;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.drawer-title {
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text-title);
}

.drawer-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.drawer-close-btn:hover {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-title);
}

.drawer-user-card {
  padding: 1rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
  margin-bottom: 1rem;
}

.drawer-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
}

/* Transiciones Drawer */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.25s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}

/* ==========================================================================
   MEDIA QUERIES (DESKTOP / TABLET / MOBILE)
   ========================================================================== */
@media (max-width: 1240px) {
  .desktop-nav {
    display: none;
  }

  .mobile-toggle-btn {
    display: flex;
  }

  .navbar-inner {
    padding: 0.75rem 1rem;
  }
}

@media (min-width: 1241px) {
  .desktop-nav {
    display: flex;
  }
  .mobile-toggle-btn {
    display: none;
  }
}

@media (max-width: 640px) {
  .navbar-wrapper {
    padding: 0.5rem 0.5rem 0 0.5rem;
  }

  .brand-title {
    font-size: 0.9375rem;
  }
}
</style>
