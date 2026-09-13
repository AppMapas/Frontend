<script setup>
import { RouterLink } from 'vue-router'
import BaseButton from '@/components/common/BaseButton.vue'
</script>

<template>
  <div class="not-found-page">
    <span class="code-badge">Error 404</span>
    <h1 class="not-found-title">Página no encontrada</h1>
    <p class="not-found-desc">
      La sección que buscas no existe o ha sido trasladada a otro módulo del sistema.
    </p>
    <RouterLink to="/terrenos">
      <BaseButton variant="primary" size="lg">
        Volver a Terrenos
      </BaseButton>
    </RouterLink>
  </div>
</template>

<style scoped>
.not-found-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
}

.code-badge {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-coral);
  background-color: var(--color-primary-subtle);
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-full);
  margin-bottom: 1rem;
}

.not-found-title {
  font-size: 2rem;
  color: var(--color-text-title);
  margin-bottom: 0.5rem;
}

.not-found-desc {
  font-size: 1rem;
  color: var(--color-text-muted);
  max-width: 480px;
  margin-bottom: 2rem;
}
</style>
