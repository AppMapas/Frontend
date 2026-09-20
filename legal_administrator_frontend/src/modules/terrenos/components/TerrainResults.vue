<script setup>
import { toCuerdas, toSquareVaras } from '../domain/units.js'
defineProps({ result: { type: Object, required: true }, record: { type: Object, default: null }, current: Boolean, converted: Boolean })
</script>

<template>
  <section class="result" aria-live="polite" aria-label="Resultado geométrico local">
    <p class="eyebrow">Área estimada del dibujo</p>
    <p class="area">{{ result.area.toFixed(2) }} <small>m²</small></p>
    <p>≈ {{ toSquareVaras(result.area).toFixed(2) }} varas²</p>
    <p>≈ {{ toCuerdas(result.area).toFixed(3) }} cuerdas</p>
    <p class="closure">{{ converted ? 'Medidas convertidas por el servidor.' : 'Vista previa con las medidas del croquis.' }}</p>
    <template v-if="record">
      <p class="registered">Área registrada: <strong>{{ record.totalAreaSquareMeters.toFixed(2) }} m²</strong> · Cálculo {{ record.id }}</p>
      <p class="closure">{{ current ? 'Esta versión está guardada.' : 'Hay cambios posteriores al registro mostrado.' }}</p>
      <p v-if="Math.abs(record.totalAreaSquareMeters - result.area) > 0.01" class="closure">El cálculo registrado utiliza las longitudes y puede diferir de la superficie del dibujo.</p>
      <p v-if="record.legalNotice" class="closure">{{ record.legalNotice }}</p>
    </template>
  </section>
</template>

<style scoped>
.result { position: relative; overflow: hidden; padding: 1rem; background: linear-gradient(145deg, var(--color-primary-subtle), var(--color-bg-card)); border: 1px solid var(--color-border-medium); border-radius: var(--radius-md); }
.result::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--color-teal-strong); }
p { margin: 0 0 .5rem; }
.eyebrow { font-size: .7rem; font-weight: 700; letter-spacing: .06em; color: var(--color-text-muted); text-transform: uppercase; }
.area { color: var(--color-teal-strong); font-size: 2.15rem; font-weight: 800; letter-spacing: -.04em; }
.area small { font-size: 1rem; }
.closure { font-size: .8rem; color: var(--color-text-muted); line-height: 1.5; }
.registered { padding-top: .6rem; border-top: 1px solid var(--color-border-medium); font-size: .85rem; }
</style>
