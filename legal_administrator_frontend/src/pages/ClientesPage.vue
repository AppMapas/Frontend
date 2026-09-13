<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'

const clientSearch = ref('')

const clients = ref([
  {
    id: 1,
    name: 'Carlos Eduardo Méndez Morales',
    dpi: '2456 78901 0901',
    phone: '+502 5543-1289',
    email: 'carlos.mendez@ejemplo.gt',
    propertiesCount: 3,
    status: 'Activo',
    badgeVariant: 'teal'
  },
  {
    id: 2,
    name: 'María Alejandra Robles Fuentes',
    dpi: '1987 65432 0901',
    phone: '+502 4432-8765',
    email: 'maria.robles@ejemplo.gt',
    propertiesCount: 1,
    status: 'En trámite',
    badgeVariant: 'soft-coral'
  },
  {
    id: 3,
    name: 'Inmobiliaria Los Altos S.A.',
    dpi: 'NIT: 8945612-4',
    phone: '+502 7765-4321',
    email: 'contacto@losaltosinmo.gt',
    propertiesCount: 8,
    status: 'Activo',
    badgeVariant: 'teal'
  },
  {
    id: 4,
    name: 'Juan Francisco Pérez Cifuentes',
    dpi: '3001 12345 0901',
    phone: '+502 5678-9012',
    email: 'jperez@ejemplo.gt',
    propertiesCount: 2,
    status: 'Activo',
    badgeVariant: 'teal'
  }
])

const filteredClients = computed(() => {
  return clients.value.filter(c =>
    c.name.toLowerCase().includes(clientSearch.value.toLowerCase()) ||
    c.dpi.includes(clientSearch.value) ||
    c.email.toLowerCase().includes(clientSearch.value.toLowerCase())
  )
})
</script>

<template>
  <div class="clientes-page">
    <PageHeader
      title="Directorio de Clientes y Propietarios"
      eyebrow="Gestión de Partes Interesadas"
      subtitle="Administración de personas individuales y jurídicas vinculadas a fincas, trámites y escrituras públicas."
    >
      <template #actions>
        <BaseButton variant="primary" size="md">
          + Registrar Nuevo Cliente
        </BaseButton>
      </template>
    </PageHeader>

    <!-- Barra de búsqueda de clientes -->
    <div class="search-bar">
      <input
        v-model="clientSearch"
        type="text"
        placeholder="Buscar por nombre, DPI/NIT o correo electrónico..."
        class="client-search-input"
      />
    </div>

    <!-- Tarjetas de Clientes -->
    <div class="clients-grid">
      <BaseCard
        v-for="client in filteredClients"
        :key="client.id"
        padding="md"
        hoverable
      >
        <template #header>
          <div class="client-header">
            <div>
              <h3 class="client-name">{{ client.name }}</h3>
              <span class="client-dpi font-mono">{{ client.dpi }}</span>
            </div>
            <BaseBadge :variant="client.badgeVariant" size="sm">
              {{ client.status }}
            </BaseBadge>
          </div>
        </template>

        <div class="client-details">
          <div class="detail-row">
            <span class="detail-label">Teléfono:</span>
            <span class="detail-val font-mono">{{ client.phone }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Correo:</span>
            <span class="detail-val">{{ client.email }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Fincas asociadas:</span>
            <span class="detail-val font-bold text-teal">{{ client.propertiesCount }} predios</span>
          </div>
        </div>

        <template #footer>
          <div class="card-actions">
            <BaseButton variant="ghost" size="sm">Expedientes</BaseButton>
            <BaseButton variant="outline" size="sm">Editar</BaseButton>
          </div>
        </template>
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
.clientes-page {
  display: flex;
  flex-direction: column;
}

.search-bar {
  margin-bottom: 1.5rem;
}

.client-search-input {
  width: 100%;
  max-width: 450px;
  padding: 0.65rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
}

.clients-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}

.client-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  gap: 0.5rem;
}

.client-name {
  font-size: 1rem;
  margin: 0 0 0.2rem 0;
  color: var(--color-text-title);
}

.client-dpi {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.client-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.detail-val {
  color: var(--color-text-body);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  width: 100%;
}

.font-mono { font-family: var(--font-mono); }
.font-bold { font-weight: 700; }
.text-teal { color: var(--color-deep-teal); }
</style>
