<script setup>
import BaseButton from './BaseButton.vue'
defineProps({ page: Number, totalPages: Number, totalElements: Number, loading: Boolean })
defineEmits(['change'])
</script>
<template>
  <nav class="pagination" aria-label="Paginación de resultados">
    <span>{{ totalElements }} registros <span v-if="totalPages">· Página {{ page + 1 }} de {{ totalPages }}</span></span>
    <div class="pagination-buttons">
      <BaseButton variant="outline" :disabled="loading || page <= 0" @click="$emit('change', page - 1)">Anterior</BaseButton>
      <BaseButton variant="outline" :disabled="loading || page + 1 >= totalPages" @click="$emit('change', page + 1)">Siguiente</BaseButton>
    </div>
  </nav>
</template>
<style scoped>
.pagination { display: flex; flex-direction: column; align-items: center; gap: .8rem; margin-top: 1.25rem; color: var(--color-text-muted); font-size: .875rem; }
.pagination-buttons { display: flex; gap: .6rem; }
.pagination :deep(button) { min-height: 44px; }
@media (min-width: 640px) { .pagination { flex-direction: row; justify-content: space-between; } }
</style>
