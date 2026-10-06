<script setup>
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
defineProps({ open: Boolean, uncertain: Boolean })
defineEmits(['decide'])
</script>
<template>
  <BaseModal :open="open" title-id="leave-form-title" @close="$emit('decide', false)">
    <div class="leave-content">
      <h2 id="leave-form-title">¿Salir de este formulario?</h2>
      <p v-if="uncertain">El servidor no ha confirmado el guardado. Reintenta la misma solicitud para comprobar el resultado antes de registrar otro registro.</p>
      <p v-else>Los cambios que no hayas guardado se perderán.</p>
      <div class="leave-actions">
        <BaseButton variant="outline" @click="$emit('decide', true)">Salir</BaseButton>
        <BaseButton @click="$emit('decide', false)">Seguir aquí</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
<style scoped>
.leave-content { padding: 1.5rem; display: grid; gap: 1rem; }
.leave-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: .75rem; }
.leave-actions :deep(button) { min-height: 44px; }
</style>
