import { ref, onMounted, onUnmounted } from 'vue'

export function useResponsive() {
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)

  const handleResize = () => {
    windowWidth.value = window.innerWidth
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  const isMobile = () => windowWidth.value < 640
  const isTablet = () => windowWidth.value >= 640 && windowWidth.value < 860
  const isDesktop = () => windowWidth.value >= 860

  return {
    windowWidth,
    isMobile,
    isTablet,
    isDesktop
  }
}
