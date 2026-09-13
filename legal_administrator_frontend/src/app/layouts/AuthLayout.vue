<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="auth-layout">
    <aside class="auth-context" aria-label="Presentación de LegalAdministrator">
      <RouterLink class="brand" :to="{ name: 'landing' }" aria-label="Volver al inicio">
        <span class="brand-mark">LA</span>
        <span>
          <strong>LegalAdministrator</strong>
          <small>Gestión jurídica</small>
        </span>
      </RouterLink>

      <div class="context-copy">
        <p class="eyebrow">Plataforma segura</p>
        <h1>Tu práctica legal, siempre bajo control.</h1>
        <p>Gestiona clientes, terrenos, expedientes y reportes desde un entorno centralizado.</p>
      </div>

      <div class="security-note">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
        </span>
        <p><strong>Acceso protegido</strong><small>Sesiones con JWT y verificación en dos pasos.</small></p>
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
  isolation: isolate;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  justify-content: space-between;
  padding: 3rem clamp(2.5rem, 5vw, 5.5rem);
  color: #fff;
  background: var(--auth-deep-teal);
}

.auth-context::before,
.auth-context::after {
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  content: '';
}

.auth-context::before {
  top: -9rem;
  right: -12rem;
  width: 30rem;
  height: 30rem;
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 0 0 4rem rgba(255,255,255,.035), 0 0 0 8rem rgba(255,255,255,.025);
}

.auth-context::after {
  right: -7rem;
  bottom: -8rem;
  width: 24rem;
  height: 24rem;
  background: rgba(255,133,145,.16);
}

.brand {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: .85rem;
  color: #fff;
  text-decoration: none;
}

.brand-mark {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: .75rem .75rem .75rem .2rem;
  background: var(--auth-coral);
  box-shadow: 5px 5px 0 rgba(23,63,70,.55);
  font-size: .75rem;
  font-weight: 800;
}

.brand > span:last-child { display: flex; flex-direction: column; }
.brand strong { font-size: .95rem; }
.brand small { color: rgba(255,255,255,.6); font-size: .62rem; letter-spacing: .13em; text-transform: uppercase; }
.context-copy { position: relative; max-width: 33rem; }
.eyebrow { margin: 0 0 1.25rem; color: #ffc1c4; font-size: .68rem; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
.context-copy h1 { max-width: 8.5em; margin: 0 0 1.5rem; color: #fff; font-family: Georgia, serif; font-size: clamp(2.5rem, 4vw, 4.6rem); line-height: 1.02; letter-spacing: -.045em; }
.context-copy > p:last-child { max-width: 31rem; margin: 0; color: rgba(255,255,255,.7); font-size: .9rem; line-height: 1.8; }
.security-note { position: relative; display: flex; align-items: center; gap: .9rem; }
.security-note > span { display: grid; width: 2.65rem; height: 2.65rem; flex: none; place-items: center; border: 1px solid rgba(255,255,255,.2); border-radius: 50%; background: rgba(255,255,255,.08); }
.security-note svg { width: 1.25rem; fill: none; stroke: #fff; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
.security-note p { display: flex; flex-direction: column; gap: .2rem; margin: 0; color: #fff; }
.security-note strong { font-size: .78rem; }.security-note small { color: rgba(255,255,255,.58); font-size: .68rem; }

.auth-main { position: relative; display: flex; min-width: 0; flex-direction: column; padding: 2.5rem clamp(2rem, 6vw, 6.5rem) 2rem; }
.auth-main::before { position: absolute; inset: 0; opacity: .38; background-image: radial-gradient(rgba(68,135,143,.12) .75px, transparent .75px); background-size: 24px 24px; mask-image: linear-gradient(to bottom right, black, transparent 64%); content: ''; pointer-events: none; }
.back-link { position: relative; z-index: 1; display: inline-flex; align-items: center; align-self: flex-end; gap: .55rem; color: #627b7e; font-size: .75rem; font-weight: 600; text-decoration: none; }
.back-link span { color: var(--auth-coral); font-size: 1rem; }
.auth-content { position: relative; z-index: 1; display: grid; width: 100%; flex: 1; place-items: center; }
.auth-footer { position: relative; z-index: 1; margin: 0; color: #8a9b9c; font-size: .62rem; text-align: center; }

@media (max-width: 860px) {
  .auth-layout { grid-template-columns: 1fr; }
  .auth-context { min-height: 15rem; justify-content: flex-start; gap: 3.5rem; padding: 2rem; }
  .context-copy h1 { max-width: 14em; font-size: 2.35rem; }
  .context-copy > p:last-child, .security-note { display: none; }
  .auth-main { min-height: calc(100vh - 15rem); padding: 1.5rem; }
}

@media (max-width: 520px) {
  .auth-context { min-height: 12rem; gap: 2.25rem; padding: 1.3rem; }
  .context-copy h1 { font-size: 1.9rem; }
  .eyebrow { margin-bottom: .75rem; }
  .auth-main { min-height: calc(100vh - 12rem); padding: 1.25rem; }
}
</style>
