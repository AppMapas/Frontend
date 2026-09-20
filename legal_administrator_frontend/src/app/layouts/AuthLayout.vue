<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="auth-layout">
    <aside class="auth-context" aria-label="Imagen de referencia cartográfica">
      <img src="/mapas.png" alt="Mapa aéreo de terrenos delimitados" />
      <div class="visual-overlay" aria-hidden="true"></div>
      <div class="visual-copy">
        <span class="visual-mark">LegalAdministrator</span>
        <p>Gestión legal y territorial con acceso protegido.</p>
      </div>
    </aside>

    <main class="auth-main">
      <RouterLink class="back-link" :to="{ name: 'landing' }">
        <span>←</span> Volver al sitio
      </RouterLink>
      <div class="auth-content">
        <RouterView />
      </div>
      <p class="auth-footer">© 2026 LegalAdministrator · Acceso exclusivo para usuarios autorizados</p>
    </main>
  </div>
</template>

<style scoped>
.auth-layout {
  display: grid;
  grid-template-columns: minmax(21rem, .9fr) minmax(34rem, 1.1fr);
  min-height: 100svh;
  color: var(--color-text-title);
  background: var(--color-off-white, #F9FAFB);
}

.auth-context {
  position: relative;
  overflow: hidden;
  min-height: 100svh;
  isolation: isolate;
  background: var(--color-deep-teal);
}

.auth-context img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; object-fit: cover; object-position: center; transform: scale(1.01); }
.visual-overlay { position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(26,35,50,.12) 20%, rgba(26,35,50,.76) 100%); }
.visual-copy { position: absolute; z-index: 2; right: clamp(1.5rem, 4vw, 3.5rem); bottom: clamp(1.5rem, 5vw, 3.5rem); left: clamp(1.5rem, 4vw, 3.5rem); color: #fff; }
.visual-mark { display: inline-flex; margin-bottom: .7rem; border: 1px solid rgba(255,255,255,.45); border-radius: 999px; padding: .35rem .65rem; font-size: .65rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; backdrop-filter: blur(4px); }
.visual-copy p { max-width: 18rem; margin: 0; color: #fff; font-size: clamp(.82rem, 1.2vw, 1rem); font-weight: 500; line-height: 1.45; }

.auth-main { position: relative; display: flex; min-width: 0; flex-direction: column; padding: clamp(1.25rem, 4vw, 2.5rem) clamp(1.25rem, 6vw, 6.5rem) 1.5rem; }
.auth-main::before { position: absolute; inset: 0; opacity: .55; background-image: radial-gradient(rgba(68,135,143,.12) .75px, transparent .75px); background-size: 24px 24px; mask-image: linear-gradient(to bottom right, black, transparent 64%); content: ''; pointer-events: none; }
.back-link { position: relative; z-index: 1; display: inline-flex; align-items: center; align-self: flex-end; gap: .55rem; color: var(--color-text-secondary, #5A6B7A); font-size: .75rem; font-weight: 600; text-decoration: none; }
.back-link span { color: var(--color-coral); font-size: 1rem; }
.auth-content { position: relative; z-index: 1; display: grid; width: 100%; flex: 1; place-items: center; }
.auth-footer { position: relative; z-index: 1; margin: 0; color: var(--color-text-muted); font-size: .62rem; text-align: center; }

@media (max-width: 860px) {
  .auth-layout { grid-template-columns: 1fr; }
  .auth-context { min-height: clamp(11rem, 28vw, 15rem); }
  .visual-copy { bottom: 1.25rem; }.visual-copy p { max-width: 28rem; }
  .auth-main { min-height: calc(100svh - clamp(11rem, 28vw, 15rem)); padding: 1.5rem; }
}

@media (max-width: 520px) {
  .auth-context { min-height: 10rem; }.visual-copy { right: 1.1rem; bottom: 1rem; left: 1.1rem; }.visual-copy p { font-size: .75rem; }
  .visual-mark { margin-bottom: .35rem; font-size: .56rem; }
  .auth-main { min-height: calc(100svh - 10rem); padding: 1.1rem 1rem; }
  .back-link { align-self: flex-start; }
  .auth-footer { margin-top: 1rem; }
}
</style>
