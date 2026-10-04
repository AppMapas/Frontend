<script setup>
defineProps({
  size: { type: [Number, String], default: 18 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M8 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    <path d="m9 9 1.5 1.5L13 8" />
    <path d="M15 9h3" />
    <path d="m9 15 1.5 1.5L13 14" />
    <path d="M15 15h3" />
  </svg>
</template>
