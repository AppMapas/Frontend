<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { agendaApi } from '../services/agendaApi.js'
import { useAuthStore } from '@/modules/auth/stores/authStore.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
const props = defineProps({ revision: Number })
const auth = useAuthStore()
const notifications = useNotificationStore()
const status = ref(null)
const busy = ref(false)
const failed = ref(false)
const confirming = ref(false)
const popupReady = ref(false)
const emit = defineEmits(['changed'])
let client = null
let intent = null
let alive = true
// Carga Google Identity una sola vez y limpia escuchas y temporizadores al finalizar.
function script() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    let element = document.getElementById('legal-google-identity')
    if (!element) {
      element = document.createElement('script')
      element.id = 'legal-google-identity'
      element.src = 'https://accounts.google.com/gsi/client'
      element.async = true
      document.head.appendChild(element)
    }
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Google no respondió. Puedes continuar utilizando la agenda.'))
    }, 15000)
    function cleanup() {
      window.clearTimeout(timer)
      element.removeEventListener('load', loaded)
      element.removeEventListener('error', errored)
    }
    function loaded() {
      cleanup()
      if (window.google?.accounts?.oauth2) {
        resolve()
      } else {
        reject(new Error('Google no pudo preparar la autorización.'))
      }
    }
    function errored() {
      cleanup()
      element.remove()
      reject(new Error('No se pudo cargar la conexión de Google. Comprueba tu conexión.'))
    }
    element.addEventListener('load', loaded, {
      once: true,
    })
    element.addEventListener('error', errored, {
      once: true,
    })
  })
}

async function refresh() {
  const currentActor = auth.user?.email
  busy.value = true
  failed.value = false
  try {
    const value = await agendaApi.googleStatus()
    if (alive && currentActor === auth.user?.email) {
      status.value = value
    }
  } catch (error) {
    if (alive && currentActor === auth.user?.email) {
      failed.value = true
      notifyRequestError(error, 'No fue posible consultar la conexión.')
    }
  } finally {
    if (alive && currentActor === auth.user?.email) {
      busy.value = false
    }
  }
}
// Prepara el state antes de un segundo clic: la autorización abre el popup desde una interacción directa.
async function prepare() {
  if (busy.value) {
    return
  }
  busy.value = true
  popupReady.value = false
  const currentActor = auth.user?.email
  try {
    await script()
    const prepared = await agendaApi.intent()
    if (!alive || auth.user?.email !== currentActor || !auth.isAuthenticated) {
      return
    }
    intent = prepared
    client = window.google.accounts.oauth2.initCodeClient({
      client_id: status.value.clientId,
      scope: status.value.scope,
      ux_mode: 'popup',
      state: prepared.state,
      select_account: true,
      callback: (response) => connected(response, currentActor, prepared.state),
      error_callback: (error) => {
        if (!alive || auth.user?.email !== currentActor) {
          return
        }
        busy.value = false
        popupReady.value = false
        let message = 'La autorización no se completó. Puedes volver a conectar.'
        if (error.type === 'popup_failed_to_open') {
          message = 'Permite las ventanas emergentes para autorizar Google Calendar.'
        }
        if (error.type === 'popup_closed') {
          message = 'Cerraste la autorización. Tu agenda interna continúa disponible.'
        }
        notifications.show(message, 'warning')
      },
    })
    popupReady.value = true
    notifications.show(
      'Conexión preparada. Pulsa Autorizar Google para elegir tu cuenta con acceso al calendario compartido.',
      'info',
    )
  } catch (error) {
    if (alive && currentActor === auth.user?.email) {
      notifyRequestError(error, 'No fue posible preparar Google Calendar.')
    }
  } finally {
    if (alive && auth.user?.email === currentActor) {
      busy.value = false
    }
  }
}

function authorize() {
  if (!client || busy.value) {
    return
  }
  busy.value = true
  client.requestCode()
}
// Descarta callbacks de una sesión anterior y exige el state esperado antes de enviar el código al backend.
async function connected(response, currentActor, expectedState) {
  popupReady.value = false
  if (!alive || !auth.isAuthenticated || auth.user?.email !== currentActor) {
    busy.value = false
    return
  }
  if (response.error || response.state !== expectedState) {
    busy.value = false
    notifications.show('La autorización de Google no se completó. Vuelve a iniciar la conexión.', 'warning')
    return
  }
  try {
    const value = await agendaApi.connect({
      code: response.code,
      state: expectedState,
    })
    if (!alive || auth.user?.email !== currentActor) {
      return
    }
    status.value = value
    notifications.show(
      'Google Calendar conectado. Las actividades pendientes comenzarán a sincronizarse.',
      'success',
    )
    emit('changed')
  } catch (error) {
    if (alive && auth.user?.email === currentActor) {
      notifyRequestError(error, 'No fue posible conectar Google Calendar.')
    }
  } finally {
    if (alive && auth.user?.email === currentActor) {
      busy.value = false
    }
    if (auth.user?.email === currentActor) {
      client = null
      intent = null
    }
  }
}

async function disconnect() {
  const currentActor = auth.user?.email
  if (busy.value) {
    return
  }
  busy.value = true
  try {
    const value = await agendaApi.disconnect()
    if (!alive || currentActor !== auth.user?.email || !auth.isAuthenticated) {
      return
    }
    status.value = value
    confirming.value = false
    notifications.show(
      'Conexión retirada de la aplicación. Las actividades internas se conservan. Puedes verificar los permisos también en tu cuenta de Google.',
      'success',
    )
    emit('changed')
  } catch (error) {
    if (alive && currentActor === auth.user?.email) {
      notifyRequestError(error, 'No fue posible desconectar.')
    }
  } finally {
    if (alive && currentActor === auth.user?.email) {
      busy.value = false
    }
  }
}

async function retry() {
  const currentActor = auth.user?.email
  busy.value = true
  try {
    const value = await agendaApi.retry()
    if (alive && currentActor === auth.user?.email) {
      status.value = value
      notifications.show('Se prepararon los reintentos pendientes.', 'success')
      emit('changed')
    }
  } catch (error) {
    if (alive && currentActor === auth.user?.email) {
      notifyRequestError(error, 'No fue posible preparar los reintentos.')
    }
  } finally {
    if (alive && currentActor === auth.user?.email) {
      busy.value = false
    }
  }
}
watch(() => props.revision, refresh)
watch(
  () => auth.user?.email,
  () => {
    status.value = null
    client = null
    intent = null
    popupReady.value = false
    busy.value = false
    failed.value = false
    confirming.value = false
  },
)
onMounted(refresh)
onBeforeUnmount(() => {
  alive = false
  intent = null
  client = null
})
</script>
<template>
  <BaseCard class="google-connection">
    <div>
      <h2>Google Calendar</h2>
      <p v-if="!status && busy" role="status">Consultando conexión…</p>
      <p v-else-if="status?.state === 'CONNECTED'">
        Conectado · {{ status.accountEmail }}
        <span v-if="status.pendingCount">· {{ status.pendingCount }} trabajos pendientes</span>
      </p>
      <p v-else-if="status?.state === 'REAUTH_REQUIRED'">
        La cuenta necesita una nueva autorización. Tu agenda se conserva.
      </p>
      <p v-else-if="status?.state === 'NO_PERMISSION'">
        Revisa el permiso de edición del calendario y vuelve a conectar.
      </p>
      <p v-else-if="status?.enabled">
        Conecta tu cuenta para consultar y gestionar el calendario compartido del despacho.
      </p>
      <p v-else>Tu agenda interna está disponible. La conexión con Google es opcional.</p>
      <small
        >En Google se comparte el horario y una referencia del expediente; las notas y datos del cliente
        permanecen aquí.</small
      >
    </div>
    <div class="actions">
      <BaseButton v-if="failed" variant="outline" :loading="busy" @click="refresh"
        >Reintentar consulta</BaseButton
      >
      <template v-else-if="status?.canManage && (status.enabled || status.state !== 'DISCONNECTED')">
        <BaseButton v-if="popupReady" :loading="busy" @click="authorize">Autorizar Google</BaseButton>
        <BaseButton
          v-else-if="status.enabled && status.state !== 'CONNECTED'"
          :loading="busy"
          @click="prepare"
          >Conectar Google</BaseButton
        >
        <BaseButton
          v-if="status.state === 'CONNECTED' && status.pendingCount"
          variant="outline"
          :disabled="busy"
          @click="retry"
          >Reintentar pendientes</BaseButton
        >
        <BaseButton
          v-if="status.state !== 'DISCONNECTED'"
          variant="outline"
          :disabled="busy"
          @click="confirming = true"
          >Desconectar</BaseButton
        >
      </template>
      <BaseButton v-if="status" variant="outline" :disabled="busy" @click="refresh"
        >Actualizar conexión</BaseButton
      >
    </div>
  </BaseCard>
  <BaseModal
    :open="confirming"
    title-id="disconnect-google-title"
    :dismissible="!busy"
    @close="confirming = false"
  >
    <div class="confirm">
      <h2 id="disconnect-google-title">Desconectar Google Calendar</h2>
      <p>
        Las actividades de la aplicación se conservarán. Tus publicaciones pendientes quedarán pausadas. Los
        eventos publicados se conservarán en Google.
      </p>
      <div class="actions">
        <BaseButton variant="outline" :disabled="busy" @click="confirming = false"
          >Conservar conexión</BaseButton
        ><BaseButton :loading="busy" @click="disconnect">Desconectar</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
<style scoped>
.google-connection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
h2 {
  font-size: 1.1rem;
}
p,
small {
  color: var(--color-text-muted);
}
small {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.85rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.confirm {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
}
</style>
