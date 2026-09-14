<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import IconUser from '@/assets/icons/IconUser.vue'
import IconChevronDown from '@/assets/icons/IconChevronDown.vue'

const props = defineProps({
  userName: {
    type: String,
    default: 'Administrador'
  },
  userRole: {
    type: String,
    default: 'Super Admin'
  },
  userEmail: {
    type: String,
    default: 'admin@legaladministrator.com'
  },
  avatarColor: {
    type: String,
    default: 'var(--color-avatar-bg)'
  }
})

const router = useRouter()
const authStore = useAuthStore()
const isOpen = ref(false)
const dropdownRef = ref(null)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

const goToProfile = () => {
  closeDropdown()
  router.push('/perfil')
}

const handleLogout = () => {
  closeDropdown()
  authStore.logout()
  router.replace({ name: 'login' })
}

// Cerrar al hacer clic fuera
const handleClickOutside = (e) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    closeDropdown()
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="user-badge-container">
    <button
      type="button"
      class="user-badge-btn"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      aria-label="Menú de usuario"
      @click="toggleDropdown"
    >
      <!-- Avatar circular reproducido fielmente de navvar.png -->
      <span class="user-avatar" :style="{ backgroundColor: avatarColor }">
        <IconUser :size="18" color="#FFFFFF" />
      </span>

      <!-- Nombre del usuario / rol -->
      <span class="user-name">{{ userName }}</span>
      <IconChevronDown :size="14" class="chevron-icon" :class="{ 'is-rotated': isOpen }" />
    </button>

    <!-- Menú desplegable accesible -->
    <transition name="dropdown-fade">
      <div v-if="isOpen" class="user-dropdown-menu" role="menu">
        <div class="user-info-header">
          <p class="user-info-name">{{ userName }}</p>
          <p class="user-info-role">{{ userRole }}</p>
          <p class="user-info-email">{{ userEmail }}</p>
        </div>

        <div class="user-menu-divider"></div>

        <button
          type="button"
          class="user-menu-item"
          role="menuitem"
          @click="goToProfile"
        >
          <IconUser :size="16" />
          <span>Mi Perfil</span>
        </button>

        <button
          type="button"
          class="user-menu-item item-danger"
          role="menuitem"
          @click="handleLogout"
        >
          <span>Cerrar sesión</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.user-badge-container {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.user-badge-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  background: transparent;
}

.user-badge-btn:hover {
  background-color: var(--color-bg-subtle);
}

.user-badge-btn:focus-visible {
  outline: 2px solid var(--color-teal);
  outline-offset: 2px;
}

/* Círculo de avatar como en navvar.png */
.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.user-name {
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-title);
  letter-spacing: -0.01em;
}

.chevron-icon {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.chevron-icon.is-rotated {
  transform: rotate(180deg);
}

/* Dropdown */
.user-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 230px;
  background-color: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 0.5rem;
  z-index: 200;
}

.user-info-header {
  padding: 0.6rem 0.75rem;
}

.user-info-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text-title);
  margin: 0;
}

.user-info-role {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-teal);
  font-weight: 600;
  margin: 0.15rem 0;
}

.user-info-email {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
  word-break: break-all;
}

.user-menu-divider {
  height: 1px;
  background-color: var(--color-border-subtle);
  margin: 0.4rem 0;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.6rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-body);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
  text-align: left;
}

.user-menu-item:hover {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-title);
}

.user-menu-item.item-danger {
  color: var(--color-danger);
}

.user-menu-item.item-danger:hover {
  background-color: rgba(217, 83, 79, 0.08);
}

/* Transición desplegable */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
