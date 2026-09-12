<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const props = defineProps({
  to: {
    type: [String, Object],
    required: true
  },
  label: {
    type: String,
    required: true
  },
  badge: {
    type: [String, Number],
    default: null
  },
  isMobile: {
    type: Boolean,
    default: false
  }
})

const route = useRoute()

// Verifica si la ruta actual coincide con el enlace
const isActive = computed(() => {
  if (!route) return false
  const targetPath = typeof props.to === 'string' ? props.to : props.to.path
  if (targetPath === '/' || targetPath === '/terrenos' || targetPath === '/formulario') {
    return route.path === '/' || route.path === '/terrenos' || route.path === '/formulario'
  }
  return route.path.startsWith(targetPath)
})
</script>

<template>
  <RouterLink
    :to="to"
    :class="[
      'nav-link',
      { 'is-active': isActive, 'is-mobile-link': isMobile }
    ]"
    :aria-current="isActive ? 'page' : undefined"
  >
    <span v-if="$slots.icon" class="nav-link-icon" aria-hidden="true">
      <slot name="icon" />
    </span>
    <span class="nav-link-text">{{ label }}</span>
    <span v-if="badge" class="nav-link-badge">{{ badge }}</span>
    <!-- Indicador de barra inferior para desktop -->
    <span v-if="!isMobile" class="nav-link-indicator" aria-hidden="true"></span>
  </RouterLink>
</template>

<style scoped>
.nav-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background-color var(--transition-fast);
  cursor: pointer;
}

/* Hover State: Utiliza el tono Soft Coral de docs/ui.md */
.nav-link:hover {
  color: var(--color-coral);
  background-color: var(--color-primary-subtle);
}

/* Focus State: Accesibilidad de teclado */
.nav-link:focus-visible {
  outline: 2px solid var(--color-teal);
  outline-offset: 2px;
}

/* Active State: Basado en navvar.png (color Coral #FF8591, font-weight 600) */
.nav-link.is-active {
  color: var(--color-coral);
  font-weight: 600;
}

.nav-link-indicator {
  position: absolute;
  bottom: -6px;
  left: 0.75rem;
  right: 0.75rem;
  height: 2.5px;
  background-color: var(--color-coral);
  border-radius: var(--radius-full);
  opacity: 0;
  transform: scaleX(0.4);
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.nav-link.is-active .nav-link-indicator {
  opacity: 1;
  transform: scaleX(1);
}

.nav-link-icon {
  display: flex;
  align-items: center;
  color: currentColor;
}

.nav-link-badge {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-full);
  background-color: var(--color-primary-subtle);
  color: var(--color-coral);
}

/* Variante Mobile */
.nav-link.is-mobile-link {
  display: flex;
  width: 100%;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  border-radius: var(--radius-md);
}

.nav-link.is-mobile-link.is-active {
  background-color: var(--color-primary-subtle);
  color: var(--color-coral);
}

.nav-link.is-mobile-link .nav-link-indicator {
  display: none;
}
</style>
