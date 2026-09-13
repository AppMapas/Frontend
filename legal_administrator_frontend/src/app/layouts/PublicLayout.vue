<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="public-layout">
    <RouterView />
  </div>
</template>

<style scoped>
.public-layout {
  min-height: 100vh;
}
</style>
