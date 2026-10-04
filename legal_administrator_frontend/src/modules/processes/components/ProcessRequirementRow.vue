<script setup>
import BaseButton from '@/components/common/BaseButton.vue'

const props = defineProps({
  item: { type: Object, required: true },
  index: { type: Number, required: true },
  count: { type: Number, required: true },
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['change', 'move', 'remove'])

function change(field, value) {
  emit('change', { ...props.item, [field]: value })
}
</script>

<template>
  <article class="requirement-row">
    <div class="row-heading">
      <span class="order-number">{{ index + 1 }}</span>
      <div class="title-group">
        <h3>{{ item.name }}</h3>
        <p v-if="item.description">{{ item.description }}</p>
      </div>
      <div v-if="!readonly" class="order-actions">
        <BaseButton
          variant="outline"
          size="sm"
          :disabled="index === 0"
          :aria-label="'Subir ' + item.name"
          @click="emit('move', -1)"
        >↑</BaseButton>
        <BaseButton
          variant="outline"
          size="sm"
          :disabled="index === count - 1"
          :aria-label="'Bajar ' + item.name"
          @click="emit('move', 1)"
        >↓</BaseButton>
      </div>
    </div>

    <div class="row-controls">
      <label class="check-field">
        <input
          type="checkbox"
          :checked="item.required"
          :disabled="readonly"
          @change="change('required', $event.target.checked)"
        >
        Obligatorio
      </label>
      <label class="check-field">
        <input
          type="checkbox"
          :checked="item.requiresDocument"
          :disabled="readonly"
          @change="change('requiresDocument', $event.target.checked)"
        >
        Requiere archivo
      </label>
    </div>

    <label class="instructions-label" :for="'instructions-' + item.requirementId">
      Instrucciones para este trámite
    </label>
    <textarea
      :id="'instructions-' + item.requirementId"
      :value="item.instructions"
      rows="2"
      :disabled="readonly"
      placeholder="Indica cómo debe entregarse o verificarse"
      @input="change('instructions', $event.target.value)"
    ></textarea>
    <BaseButton v-if="!readonly" variant="ghost" size="sm" class="remove-button" @click="emit('remove')">
      Quitar de este trámite
    </BaseButton>
  </article>
</template>

<style scoped>
.requirement-row { display: grid; gap: .8rem; padding: 1rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: var(--color-bg-card); }
.row-heading { display: flex; align-items: flex-start; gap: .7rem; }
.order-number { display: grid; place-items: center; flex: 0 0 2rem; height: 2rem; border-radius: var(--radius-full); background: var(--color-primary-subtle); color: var(--color-primary); font-family: var(--font-mono); font-weight: 700; }
.title-group { flex: 1; min-width: 0; }
.title-group h3 { font-size: .98rem; overflow-wrap: anywhere; }
.title-group p { color: var(--color-text-muted); font-size: .82rem; margin-top: .2rem; overflow-wrap: anywhere; }
.order-actions { display: flex; gap: .3rem; }
.order-actions :deep(button) { min-width: 36px; font-size: 1.05rem; }
.row-controls { display: flex; flex-wrap: wrap; gap: 1rem; }
.check-field { display: inline-flex; align-items: center; gap: .5rem; color: var(--color-text-body); font-size: .88rem; font-weight: 600; }
.check-field input { width: 1.1rem; height: 1.1rem; accent-color: var(--color-primary); }
.instructions-label { color: var(--color-text-title); font-size: .83rem; font-weight: 650; }
textarea { width: 100%; font-size: .95rem; resize: vertical; }
.remove-button { justify-self: start; color: var(--color-danger-strong); }
@media (max-width: 480px) {
  .row-heading { flex-wrap: wrap; }
  .order-actions { margin-left: auto; }
  .order-actions :deep(button) { min-width: 44px; min-height: 44px; }
  .row-controls { gap: .4rem 1rem; }
  .check-field { min-height: 40px; }
}
</style>
