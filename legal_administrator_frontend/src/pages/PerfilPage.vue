<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import IconUser from '@/assets/icons/IconUser.vue'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import TwoFactorSettings from '@/modules/auth/components/two-factor/TwoFactorSettings.vue'

const authStore = useAuthStore()
</script>

<template>
  <div class="perfil-page">
    <PageHeader
      title="Perfil de Usuario"
      eyebrow="Configuración de Cuenta"
      subtitle="Datos del operador, rol asignado en el sistema y parámetros de sesión."
    />

    <div class="profile-grid">
      <!-- Tarjeta Principal de Usuario -->
      <BaseCard>
        <div class="profile-hero">
          <div class="profile-avatar-large">
            <IconUser :size="42" color="#FFFFFF" />
          </div>
          <div class="profile-title-info">
            <h2>{{ authStore.user?.name || 'Usuario' }}</h2>
            <p class="role-tag">{{ authStore.user?.role || 'Sin rol asignado' }}</p>
            <BaseBadge variant="coral">Sesión Activa</BaseBadge>
          </div>
        </div>

        <div class="profile-details-list">
          <div class="detail-item">
            <span class="detail-name">Correo Electrónico:</span>
            <span class="detail-value">{{ authStore.user?.email || 'No disponible' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-name">Entorno:</span>
            <span class="detail-value font-mono">Producción Local (Docker)</span>
          </div>
          <div class="detail-item">
            <span class="detail-name">Permisos:</span>
            <span class="detail-value">Cálculo de Áreas, Edición Registral, Reportes y Usuarios</span>
          </div>
          <div class="detail-item">
            <span class="detail-name">Último acceso:</span>
            <span class="detail-value font-mono">Hoy a las 01:50 hrs</span>
          </div>
        </div>

        <template #footer>
          <div class="profile-actions">
            <BaseButton variant="outline" size="sm">Cambiar Contraseña</BaseButton>
            <BaseButton variant="primary" size="sm">Actualizar Datos</BaseButton>
          </div>
        </template>
      </BaseCard>

      <!-- Tarjeta de Auditoría / Preferencias -->
      <BaseCard>
        <template #header>
          <h3>Preferencias del Sistema</h3>
        </template>

        <div class="pref-list">
          <div class="pref-item">
            <div>
              <strong>Unidad de Medida Predeterminada</strong>
              <p class="text-muted">Se utiliza como base para cálculos geométricos</p>
            </div>
            <BaseBadge variant="teal">Varas / Metros</BaseBadge>
          </div>

          <div class="pref-divider"></div>

          <div class="pref-item">
            <div>
              <strong>Tema Visual</strong>
              <p class="text-muted">Paleta oficial definida en docs/ui.md</p>
            </div>
            <BaseBadge variant="coral">Oficial UI 2026</BaseBadge>
          </div>
        </div>
      </BaseCard>

      <TwoFactorSettings />
    </div>
  </div>
</template>

<style scoped>
.perfil-page {
  display: flex;
  flex-direction: column;
}

.profile-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 1.5rem;
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  margin-bottom: 1.5rem;
}

.profile-avatar-large {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: var(--color-avatar-bg);
  box-shadow: var(--shadow-md);
  flex-shrink: 0;
}

.profile-title-info h2 {
  font-size: 1.35rem;
  margin: 0 0 0.25rem 0;
}

.role-tag {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 0.5rem 0;
}

.profile-details-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  padding: 0.4rem 0;
  border-bottom: 1px dashed var(--color-border-subtle);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-name {
  color: var(--color-text-muted);
  font-weight: 500;
}

.detail-value {
  color: var(--color-text-body);
  font-weight: 600;
}

.profile-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.pref-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pref-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.pref-item p {
  margin: 0.2rem 0 0 0;
  font-size: 0.8125rem;
}

.pref-divider {
  height: 1px;
  background-color: var(--color-border-subtle);
}

.font-mono { font-family: var(--font-mono); }
.text-muted { color: var(--color-text-muted); }

@media (max-width: 860px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}
</style>
