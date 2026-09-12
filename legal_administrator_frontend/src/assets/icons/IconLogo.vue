<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 20
  },
  color: {
    type: String,
    default: 'currentColor'
  }
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- Rectángulo tipo carnet/tarjeta con detalles como en navvar.png -->
    <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" stroke-width="2" />
    <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" stroke-width="2" />
    <line x1="6" y1="14" x2="10" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
</template>
