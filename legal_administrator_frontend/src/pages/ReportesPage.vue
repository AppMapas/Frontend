<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import ComingSoonState from '@/components/common/ComingSoonState.vue'
</script>

<template>
  <div class="reportes-page">
    <PageHeader
      title="Reportes y Estadísticas"
      eyebrow="Analítica del Sistema"
      subtitle="Indicadores y reportes construidos a partir de los registros reales del sistema."
    />
    <ComingSoonState
      title="Estamos preparando los reportes"
      description="Esta sección se habilitará cuando las métricas y exportaciones estén conectadas al backend. Los indicadores de demostración fueron retirados."
    />
  </div>
</template>
