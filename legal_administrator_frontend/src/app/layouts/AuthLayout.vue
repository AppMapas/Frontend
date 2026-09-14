<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="auth-layout">
    <aside class="auth-context" aria-label="Mapa de terrenos">
      <img src="/mapas.png" alt="Mapa aéreo de terrenos delimitados" />
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
  --auth-coral: #ff8591;
  --auth-soft-coral: #efaaa3;
  --auth-sage: #8caaa2;
  --auth-teal: #5a9b95;
  --auth-deep-teal: #44878f;
  --auth-ink: #173f46;
  display: grid;
  grid-template-columns: minmax(350px, 0.82fr) minmax(500px, 1.18fr);
  min-height: 100vh;
  color: var(--auth-ink);
  background: #fffaf8;
}

.auth-context {
  position: relative;
  overflow: hidden;
  background: var(--auth-deep-teal);
}

.auth-context img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: center; }

.auth-main { position: relative; display: flex; min-width: 0; flex-direction: column; padding: 2.5rem clamp(2rem, 6vw, 6.5rem) 2rem; }
.auth-main::before { position: absolute; inset: 0; opacity: .38; background-image: radial-gradient(rgba(68,135,143,.12) .75px, transparent .75px); background-size: 24px 24px; mask-image: linear-gradient(to bottom right, black, transparent 64%); content: ''; pointer-events: none; }
.back-link { position: relative; z-index: 1; display: inline-flex; align-items: center; align-self: flex-end; gap: .55rem; color: #627b7e; font-size: .75rem; font-weight: 600; text-decoration: none; }
.back-link span { color: var(--auth-coral); font-size: 1rem; }
.auth-content { position: relative; z-index: 1; display: grid; width: 100%; flex: 1; place-items: center; }
.auth-footer { position: relative; z-index: 1; margin: 0; color: #8a9b9c; font-size: .62rem; text-align: center; }

@media (max-width: 860px) {
  .auth-layout { grid-template-columns: 1fr; }
  .auth-context { min-height: 15rem; }
  .auth-main { min-height: calc(100vh - 15rem); padding: 1.5rem; }
}

@media (max-width: 520px) {
  .auth-context { min-height: 12rem; }
  .auth-main { min-height: calc(100vh - 12rem); padding: 1.25rem; }
}
</style>
