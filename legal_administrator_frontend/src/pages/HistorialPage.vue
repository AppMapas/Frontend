<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import ComingSoonState from '@/components/common/ComingSoonState.vue'
</script>

<template>
  <div class="historial-page">
    <PageHeader
      title="Historial de Expedientes"
      eyebrow="Registro de Cálculos"
      subtitle="Consulta y seguimiento de los cálculos de terrenos almacenados."
    />
    <ComingSoonState
      title="El historial está en construcción"
      description="Estamos conectando esta vista con los registros reales del backend para ofrecer búsqueda, detalle y descarga sin mostrar información simulada."
    />
  </div>
</template>
