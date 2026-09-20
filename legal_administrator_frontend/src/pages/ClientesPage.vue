<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import ComingSoonState from '@/components/common/ComingSoonState.vue'
</script>

<template>
  <div class="clientes-page">
    <PageHeader
      title="Directorio de Clientes y Propietarios"
      eyebrow="Gestión de Partes Interesadas"
      subtitle="Administración de personas vinculadas a fincas, trámites y escrituras públicas."
    />
    <ComingSoonState
      title="El directorio estará disponible próximamente"
      description="Estamos preparando la consulta y administración de clientes con información real del sistema. Los datos de demostración fueron retirados."
    />
  </div>
</template>
