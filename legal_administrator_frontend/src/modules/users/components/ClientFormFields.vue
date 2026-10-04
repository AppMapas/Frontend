<script setup>
import { ref } from 'vue'
const props = defineProps({
  modelValue: { type: Object, required: true },
  countries: { type: Array, default: () => [] },
  maritalStatuses: { type: Array, default: () => [] },
  municipalities: { type: Array, default: () => [] },
  errors: { type: Object, default: () => ({}) },
  editing: Boolean,
  disabled: Boolean,
  prefix: { type: String, default: 'client' },
})
const emit = defineEmits(['update:modelValue'])
const fields = ref(null)
const textFields = [
  { name: 'firstName', label: 'Nombres', autocomplete: 'given-name', max: 100 },
  { name: 'lastName', label: 'Apellidos', autocomplete: 'family-name', max: 100 },
  { name: 'email', label: 'Correo electrónico', autocomplete: 'email', type: 'email', max: 100 },
  { name: 'phone', label: 'Teléfono', autocomplete: 'tel', type: 'tel', max: 13 },
]
function update(name, value) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
}
function focusInvalid() {
  fields.value?.querySelector('[aria-invalid="true"]')?.focus()
}
defineExpose({ focusInvalid })
</script>

<template>
  <fieldset ref="fields" class="client-fields" :disabled="disabled">
    <legend>Datos personales del cliente</legend>
    <p class="help">Los campos marcados con * son obligatorios.</p>
    <div class="fields-grid">
      <label :for="prefix + '-dpi'">
        DPI *
        <input :id="prefix + '-dpi'" name="dpi" :value="modelValue.dpi" type="text" inputmode="numeric"
          maxlength="13" autocomplete="off" :disabled="editing" required
          :aria-invalid="Boolean(errors.dpi)" :aria-describedby="prefix + '-dpi-help'"
          @input="update('dpi', $event.target.value)">
        <small :id="prefix + '-dpi-help'">13 dígitos, sin espacios ni guiones. Se conserva al editar.</small>
      </label>
      <label v-for="field in textFields" :key="field.name" :for="prefix + '-' + field.name">
        {{ field.label }} *
        <input :id="prefix + '-' + field.name" :name="field.name" :value="modelValue[field.name]"
          :type="field.type || 'text'" :autocomplete="field.autocomplete" :maxlength="field.max"
          :aria-invalid="Boolean(errors[field.name])" required @input="update(field.name, $event.target.value)">
      </label>
      <label :for="prefix + '-birthDate'">
        Fecha de nacimiento
        <input :id="prefix + '-birthDate'" name="birthDate" type="date" :value="modelValue.birthDate"
          :aria-invalid="Boolean(errors.birthDate)" @input="update('birthDate', $event.target.value)">
      </label>
      <label :for="prefix + '-nationalityId'">
        Nacionalidad *
        <select :id="prefix + '-nationalityId'" name="nationalityId" :value="modelValue.nationalityId"
          :aria-invalid="Boolean(errors.nationalityId)" required @change="update('nationalityId', $event.target.value)">
          <option value="">Selecciona una nacionalidad</option>
          <option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name }}</option>
        </select>
      </label>
      <label :for="prefix + '-maritalStatusId'">
        Estado civil *
        <select :id="prefix + '-maritalStatusId'" name="maritalStatusId" :value="modelValue.maritalStatusId"
          :aria-invalid="Boolean(errors.maritalStatusId)" required @change="update('maritalStatusId', $event.target.value)">
          <option value="">Selecciona un estado civil</option>
          <option v-for="status in maritalStatuses" :key="status.id" :value="status.id">{{ status.name }}</option>
        </select>
      </label>
      <label :for="prefix + '-occupation'">
        Ocupación
        <input :id="prefix + '-occupation'" name="occupation" type="text" maxlength="150" :value="modelValue.occupation"
          :aria-invalid="Boolean(errors.occupation)" @input="update('occupation', $event.target.value)">
      </label>
      <label :for="prefix + '-municipalityId'">
        Municipio
        <select :id="prefix + '-municipalityId'" name="municipalityId" :value="modelValue.municipalityId"
          :aria-invalid="Boolean(errors.municipalityId)" @change="update('municipalityId', $event.target.value)">
          <option value="">Sin especificar</option>
          <option v-for="municipality in municipalities" :key="municipality.id" :value="municipality.id">
            {{ municipality.name }} · Departamento {{ municipality.departmentCode }}
          </option>
        </select>
      </label>
      <label class="full" :for="prefix + '-exactAddress'">
        Dirección exacta *
        <textarea :id="prefix + '-exactAddress'" name="exactAddress" :value="modelValue.exactAddress" rows="3"
          autocomplete="street-address" maxlength="255" :aria-invalid="Boolean(errors.exactAddress)" required
          @input="update('exactAddress', $event.target.value)"></textarea>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.client-fields { border: 0; padding: 0; min-width: 0; }
legend { font-weight: 700; color: var(--color-text-title); font-size: 1rem; }
.help { color: var(--color-text-muted); font-size: .875rem; margin: .4rem 0 1rem; }
.fields-grid { display: grid; gap: 1rem; }
label { display: grid; align-content: start; gap: .4rem; font-size: .9rem; font-weight: 600; min-width: 0; }
input, select, textarea { width: 100%; min-width: 0; min-height: 46px; font-size: 1rem; border-color: var(--color-border-control); }
textarea { resize: vertical; }
small { color: var(--color-text-muted); font-size: .8rem; font-weight: 400; }
[aria-invalid="true"] { border-color: var(--color-danger); }
@media (min-width: 720px) { .fields-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .full { grid-column: 1 / -1; } }
</style>
