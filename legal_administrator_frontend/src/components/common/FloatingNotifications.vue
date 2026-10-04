<script setup>
import CatalogToast from '@/modules/processes/components/CatalogToast.vue'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
const notifications = useNotificationStore()
</script>

<template>
  <CatalogToast v-if="notifications.current" :key="notifications.current.id"
    :message="notifications.current.message" :tone="notifications.current.tone"
    :action-label="notifications.current.actionLabel"
    @close="notifications.close" @action="notifications.runAction" />
</template>
