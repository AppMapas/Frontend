<script setup>
import MainLayout from '@/layouts/MainLayout.vue'
</script>

<template>
  <MainLayout>
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </MainLayout>
</template>

<style>
/* Estilos globales y transiciones a nivel de App */
</style>
