<script setup>
import BaseButton from '@/components/common/BaseButton.vue'
defineProps({ name: String, saved: Boolean, disabled: Boolean })
defineEmits(['view', 'remove', 'download'])
</script>
<template>
  <div class="receipt-row">
    <div class="receipt-name"><strong>{{ name }}</strong><span>{{ saved ? 'Comprobante guardado' : 'PDF seleccionado · se guardará al registrar el abono' }}</span></div>
    <div class="receipt-actions">
      <BaseButton variant="outline" size="sm" :disabled="disabled" title="Ver comprobante" aria-label="Ver comprobante" @click="$emit('view')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
      </BaseButton>
      <BaseButton variant="outline" size="sm" :disabled="disabled" title="Quitar comprobante" aria-label="Quitar comprobante" @click="$emit('remove')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>
      </BaseButton>
      <BaseButton variant="outline" size="sm" :disabled="disabled" title="Descargar comprobante" aria-label="Descargar comprobante" @click="$emit('download')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg>
      </BaseButton>
    </div>
  </div>
</template>
<style scoped>
.receipt-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; padding: .75rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); }
.receipt-name { display: grid; gap: .25rem; min-width: 0; overflow-wrap: anywhere; }
.receipt-name span { font-size: .85rem; color: var(--color-text-muted); }
.receipt-actions { display: flex; gap: .4rem; }
svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
