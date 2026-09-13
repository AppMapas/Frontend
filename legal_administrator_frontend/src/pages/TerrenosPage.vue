<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const frameRef = ref(null)
const frameHeight = ref(960)

// Sincronización dinámica de altura del iframe para una experiencia fluida sin scroll anidado
const updateFrameHeight = () => {
  if (!frameRef.value) return
  try {
    const doc = frameRef.value.contentWindow?.document
    if (doc && doc.body) {
      const scrollH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight)
      if (scrollH > 400) {
        frameHeight.value = scrollH + 30
      }
    }
  } catch (e) {
    // Preservar altura segura si existe alguna restricción
  }
}

let intervalId = null

onMounted(() => {
  window.addEventListener('resize', updateFrameHeight)
  intervalId = setInterval(updateFrameHeight, 350)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateFrameHeight)
  if (intervalId) clearInterval(intervalId)
})

const onFrameLoad = () => {
  updateFrameHeight()
}
</script>

<template>
  <div class="terrenos-page">
    <div class="iframe-container">
      <!-- 
        Lienzo interactivo de Terrenos estilizado fielmente al mockup terrenos.jpg,
        preservando el 100% de la lógica matemática y algoritmos del archivo original.
      -->
      <iframe
        ref="frameRef"
        src="/calculo_areas_demo_4.html"
        title="Plano de Trazo y Cálculo de Terrenos"
        class="terrenos-frame"
        :style="{ height: `${frameHeight}px` }"
        frameborder="0"
        @load="onFrameLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.terrenos-page {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.iframe-container {
  width: 100%;
  overflow: hidden;
  background-color: transparent;
  border: none;
}

.terrenos-frame {
  width: 100%;
  border: none;
  display: block;
  background-color: transparent;
  transition: height 0.15s ease-out;
}
</style>
