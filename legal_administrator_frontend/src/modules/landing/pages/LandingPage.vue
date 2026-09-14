<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

const menuOpen = ref(false)
const formSent = ref(false)

const closeMenu = () => {
  menuOpen.value = false
}

const submitForm = () => {
  formSent.value = true
}

const services = [
  {
    number: '01',
    title: 'Consultoría legal',
    text: 'Análisis inicial de tu situación, revisión de opciones y definición de una ruta de acción clara.',
    image: '/servicio-consultoria.png',
  },
  {
    number: '02',
    title: 'Contratos y documentos',
    text: 'Redacción, revisión y negociación de documentos para acuerdos más seguros y transparentes.',
    image: '/servicio-contratos.png',
  },
  {
    number: '03',
    title: 'Representación y defensa',
    text: 'Acompañamiento diligente en la preparación, seguimiento y representación de tu asunto.',
    image: '/servicio-defensa.png',
  },
]
</script>

<template>
  <div class="landing-page">
    <header class="site-header">
      <div class="container nav-wrap">
        <a class="brand" href="#inicio" aria-label="Licenciada Azucely Loayes, inicio" @click="closeMenu">
          <span class="monogram">AL</span>
          <span class="brand-copy"><strong>Licda. Azucely Loayes</strong><small>Abogada y Notaria</small></span>
        </a>

        <button
          class="menu-button"
          type="button"
          aria-label="Abrir menú"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span></span><span></span><span></span>
        </button>

        <nav class="main-nav" :class="{ open: menuOpen }" aria-label="Navegación principal">
          <a href="#servicios" @click="closeMenu">Servicios</a>
          <a href="#perfil" @click="closeMenu">Perfil</a>
          <a href="#proceso" @click="closeMenu">Proceso</a>
          <a href="#contacto" @click="closeMenu">Contacto</a>
          <RouterLink class="login-link" :to="{ name: 'login' }" @click="closeMenu">Iniciar sesión</RouterLink>
          <a class="nav-cta" href="#contacto" @click="closeMenu">Agendar consulta <span>→</span></a>
        </nav>
      </div>
    </header>

    <main>
      <section id="inicio" class="hero">
        <div class="hero-pattern"></div>
        <div class="container hero-grid">
          <div class="hero-copy">
            <p class="eyebrow"><span></span> Asesoría jurídica con propósito</p>
            <h1>Tu caso merece una <em>estrategia clara.</em></h1>
            <p class="hero-text">
              Acompañamiento legal cercano, riguroso y transparente para tomar decisiones con confianza desde la primera consulta.
            </p>
            <div class="hero-actions">
              <a class="button button-primary" href="#contacto">Agendar una consulta <span>→</span></a>
              <a class="button button-secondary" href="#servicios">Conocer mis servicios</a>
            </div>
            <div class="availability">
              <span class="availability-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/><path d="m8 15 2 2 5-5"/></svg>
              </span>
              <p><strong>Atención con cita previa</strong><small>Cuéntame tu situación y encontraremos el mejor siguiente paso.</small></p>
            </div>
          </div>

          <div class="portrait-column">
            <div class="portrait-accent"></div>
            <figure class="portrait-card">
              <img src="/licda-azucely-loayes.png" alt="Abogada revisando documentos en una oficina" />
              <figcaption>
                <span></span>
                <p><strong>Defensa informada. Atención humana.</strong><small>Soluciones legales pensadas para ti.</small></p>
              </figcaption>
            </figure>
            <div class="experience-card"><strong>Compromiso</strong><span>en cada etapa de tu caso</span></div>
          </div>
        </div>
      </section>

      <section class="values" aria-label="Valores profesionales">
        <div class="container values-grid">
          <article>
            <span class="value-icon"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg></span>
            <div><h2>Confidencialidad</h2><p>Tu información y tu historia se tratan con absoluta reserva.</p></div>
          </article>
          <article>
            <span class="value-icon"><svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 9h8M8 13h5"/></svg></span>
            <div><h2>Comunicación clara</h2><p>Sin tecnicismos innecesarios: sabrás qué ocurre en cada etapa.</p></div>
          </article>
          <article>
            <span class="value-icon"><svg viewBox="0 0 24 24"><path d="M12 3v18M5 7h14M5 7l-3 6h6L5 7ZM19 7l-3 6h6l-3-6ZM8 21h8"/></svg></span>
            <div><h2>Estrategia a medida</h2><p>Cada asunto recibe un análisis responsable y una ruta concreta.</p></div>
          </article>
        </div>
      </section>

      <section id="servicios" class="section services-section">
        <div class="container section-intro">
          <p class="eyebrow"><span></span> Áreas de práctica</p>
          <div class="intro-grid">
            <h2>Orientación legal para <em>decisiones importantes.</em></h2>
            <p>Servicios enfocados en prevenir conflictos, proteger tus intereses y acompañarte con una mirada estratégica.</p>
          </div>
        </div>

        <div class="container services-grid">
          <article v-for="service in services" :key="service.title" class="service-card">
            <div class="service-image">
              <img :src="service.image" :alt="service.title" />
              <span>{{ service.number }}</span>
            </div>
            <div class="service-body">
              <h3>{{ service.title }}</h3>
              <p>{{ service.text }}</p>
              <a href="#contacto" :aria-label="`Consultar sobre ${service.title}`">Consultar <span>→</span></a>
            </div>
          </article>
        </div>
      </section>

      <section id="perfil" class="section profile-section">
        <div class="container profile-grid">
          <div class="profile-visual">
            <div class="profile-frame"><img src="/licda-azucely-loayes.png" alt="Profesional del derecho revisando un expediente" /></div>
            <div class="signature-card"><span>AL</span><p><strong>Licda. Azucely Loayes</strong><small>Abogada y Notaria</small></p></div>
          </div>
          <div class="profile-copy">
            <p class="eyebrow light"><span></span> Una defensa cercana</p>
            <h2>Rigor jurídico con un trato <em>profundamente humano.</em></h2>
            <p>Detrás de cada consulta hay una decisión importante, una familia o un proyecto que merece ser escuchado. Mi trabajo comienza por comprender tu situación y explicarte con honestidad las alternativas disponibles.</p>
            <p>Recibirás acompañamiento atento, comunicación directa y una estrategia construida alrededor de tus necesidades.</p>
            <div class="profile-points">
              <span><i>✓</i> Análisis responsable</span>
              <span><i>✓</i> Trato personalizado</span>
              <span><i>✓</i> Seguimiento constante</span>
              <span><i>✓</i> Comunicación transparente</span>
            </div>
            <a class="text-link light-link" href="#contacto">Conversemos sobre tu caso <span>→</span></a>
          </div>
        </div>
      </section>

      <section id="proceso" class="section process-section">
        <div class="container process-heading">
          <div>
            <p class="eyebrow"><span></span> Cómo trabajamos</p>
            <h2>Una atención ordenada <em>desde el inicio.</em></h2>
          </div>
          <p>El objetivo es que tengas claridad, contexto y una recomendación legal útil para avanzar.</p>
        </div>
        <div class="container process-grid">
          <article><span>01</span><h3>Cuéntame tu caso</h3><p>Comparte un resumen de tu situación mediante el formulario de contacto.</p></article>
          <article><span>02</span><h3>Coordinamos la cita</h3><p>Recibirás seguimiento para acordar el momento de tu consulta.</p></article>
          <article><span>03</span><h3>Definimos la estrategia</h3><p>Analizamos alternativas y establecemos pasos claros para tu situación.</p></article>
        </div>
      </section>

      <section class="statement-section">
        <div class="container statement-wrap">
          <span class="quote">“</span>
          <blockquote>Una buena decisión legal comienza con información clara y una profesional dispuesta a escuchar.</blockquote>
          <div class="statement-name"><span></span><p><strong>Azucely Loayes</strong><small>Abogada y Notaria</small></p></div>
        </div>
      </section>

      <section id="contacto" class="section contact-section">
        <div class="container contact-grid">
          <div class="contact-copy">
            <p class="eyebrow"><span></span> Solicita una cita</p>
            <h2>Hablemos de <em>tu situación.</em></h2>
            <p>Completa tus datos y una breve descripción. Me pondré en contacto contigo para coordinar la consulta.</p>
            <div class="contact-detail">
              <span><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="m4 6 8 6 8-6"/></svg></span>
              <p><small>Contacto</small><strong>Mediante el formulario de consulta</strong></p>
            </div>
            <div class="contact-detail">
              <span><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 13 13 0 0 0 2.8.7 2 2 0 0 1 1.7 2Z"/></svg></span>
              <p><small>Horario de atención</small><strong>Lunes a viernes · Con cita previa</strong></p>
            </div>
            <small class="privacy-note">La información compartida será utilizada únicamente para dar seguimiento a tu solicitud de consulta.</small>
          </div>

          <div class="form-panel">
            <div v-if="formSent" class="success-message" role="status">
              <span>✓</span>
              <h3>Solicitud recibida</h3>
              <p>Gracias por compartir tu información. Me pondré en contacto contigo para coordinar la consulta.</p>
              <button type="button" @click="formSent = false">Enviar otra solicitud</button>
            </div>
            <form v-else @submit.prevent="submitForm">
              <div class="field full-field"><label for="nombre">Nombre completo</label><input id="nombre" name="nombre" type="text" placeholder="Escribe tu nombre" autocomplete="name" required /></div>
              <div class="field"><label for="correo">Correo electrónico</label><input id="correo" name="correo" type="email" placeholder="nombre@correo.com" autocomplete="email" required /></div>
              <div class="field"><label for="telefono">Número telefónico</label><input id="telefono" name="telefono" type="tel" placeholder="Tu número de contacto" autocomplete="tel" required /></div>
              <div class="field full-field"><label for="asunto">Asunto de la consulta</label><select id="asunto" name="asunto" required><option value="" disabled selected>Selecciona una opción</option><option>Consultoría legal</option><option>Contratos y documentos</option><option>Representación y defensa</option><option>Otro asunto</option></select></div>
              <div class="field full-field"><label for="mensaje">Contexto de tu consulta</label><textarea id="mensaje" name="mensaje" placeholder="Cuéntame brevemente cómo puedo ayudarte" rows="4" required></textarea></div>
              <button class="button button-primary submit-button" type="submit">Enviar solicitud <span>→</span></button>
              <small>Al enviar, aceptas que tus datos sean usados para responder a esta solicitud.</small>
            </form>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container footer-main">
        <div class="footer-brand">
          <a class="brand" href="#inicio"><span class="monogram">AL</span><span class="brand-copy"><strong>Licda. Azucely Loayes</strong><small>Abogada y Notaria</small></span></a>
          <p>Asesoría jurídica cercana, rigurosa y transparente.</p>
        </div>
        <nav aria-label="Enlaces del pie de página"><a href="#servicios">Servicios</a><a href="#perfil">Perfil</a><a href="#proceso">Proceso</a><a href="#contacto">Contacto</a></nav>
        <a class="footer-cta" href="#contacto">Agendar consulta <span>→</span></a>
      </div>
      <div class="container footer-bottom"><span>© 2026 Licda. Azucely Loayes. Todos los derechos reservados.</span><div><a href="#">Privacidad</a><a href="#">Aviso legal</a></div></div>
    </footer>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap');

.landing-page {
  --coral: #ff8591;
  --soft-coral: #efaaa3;
  --sage: #8caaa2;
  --teal: #5a9b95;
  --deep-teal: #44878f;
  --navy: #173f46;
  --navy-deep: #102f35;
  --ivory: #fffaf7;
  --sand: #f7efeb;
  --paper: #ffffff;
  --text: #203e42;
  --muted: #63797b;
  --line: rgba(68, 135, 143, 0.17);
}

* { box-sizing: border-box; }
button, input, textarea, select { font: inherit; }
a { color: inherit; }
img { display: block; max-width: 100%; }
svg { display: block; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
h1, h2, h3, p { margin-top: 0; }
h1, h2 { font-family: 'Playfair Display', Georgia, serif; }
h2 { margin-bottom: 0; font-size: clamp(2.25rem, 4vw, 3.5rem); line-height: 1.08; letter-spacing: -.035em; }
h1 em, h2 em { color: var(--coral); font-weight: 600; }
.landing-page { min-width: 320px; min-height: 100vh; overflow: hidden; width: 100%; color: var(--text); background: var(--ivory); font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
.container { width: min(1160px, calc(100% - 48px)); margin-inline: auto; }
.section { padding: 112px 0; }

.site-header { position: fixed; z-index: 50; top: 0; width: 100%; border-bottom: 1px solid rgba(68,135,143,.12); background: rgba(255,250,247,.93); backdrop-filter: blur(16px); }
.nav-wrap { display: flex; height: 78px; align-items: center; justify-content: space-between; }
.brand { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; }
.monogram { display: grid; width: 41px; height: 41px; place-items: center; border-radius: 2px; color: white; background: var(--navy); box-shadow: 5px 5px 0 var(--coral); font-family: 'Playfair Display'; font-size: 12px; font-weight: 700; letter-spacing: .05em; }
.brand-copy { display: flex; flex-direction: column; gap: 2px; }
.brand-copy strong { color: var(--navy); font-family: 'Playfair Display'; font-size: 14px; line-height: 1; }
.brand-copy small { color: var(--deep-teal); font-size: 7px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.main-nav { display: flex; align-items: center; gap: 28px; }
.main-nav > a { position: relative; color: #526c70; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-decoration: none; text-transform: uppercase; }
.main-nav > a:not(.nav-cta)::after { position: absolute; right: 0; bottom: -8px; left: 0; height: 2px; transform: scaleX(0); background: var(--coral); content: ''; transition: transform .2s; }
.main-nav > a:hover::after { transform: scaleX(1); }
.main-nav .login-link { color: var(--navy); }
.main-nav .nav-cta { display: inline-flex; min-height: 42px; align-items: center; gap: 10px; border-radius: 3px; padding: 0 18px; color: white; background: var(--navy); box-shadow: 0 9px 22px rgba(23,63,70,.18); }
.nav-cta span { color: var(--coral); font-size: 15px; }
.menu-button { display: none; width: 43px; height: 43px; border: 0; background: var(--sand); }
.menu-button span { display: block; width: 20px; height: 2px; margin: 4px auto; background: var(--navy); }

.hero { position: relative; min-height: 790px; padding: 165px 0 105px; background: var(--ivory); }
.hero-pattern { position: absolute; inset: 0; opacity: .48; background-image: linear-gradient(rgba(68,135,143,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(68,135,143,.07) 1px, transparent 1px); background-size: 35px 35px; mask-image: linear-gradient(to right, #000, transparent 82%); }
.hero::after { position: absolute; top: 65px; right: -120px; width: 540px; height: 540px; border-radius: 50%; background: rgba(255,133,145,.10); content: ''; }
.hero-grid { position: relative; z-index: 2; display: grid; grid-template-columns: .9fr 1.1fr; align-items: center; gap: 85px; }
.eyebrow { display: flex; align-items: center; gap: 11px; margin-bottom: 22px; color: var(--deep-teal); font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
.eyebrow > span { display: inline-block; width: 31px; height: 1px; background: currentColor; }
.hero h1 { max-width: 570px; margin-bottom: 27px; color: var(--navy); font-size: clamp(3.4rem, 6vw, 5.25rem); line-height: .98; letter-spacing: -.055em; }
.hero h1 em { display: block; }
.hero-text { max-width: 570px; margin-bottom: 34px; color: var(--muted); font-size: 16px; line-height: 1.8; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.button { display: inline-flex; min-height: 50px; align-items: center; justify-content: center; gap: 11px; border: 1px solid transparent; border-radius: 3px; padding: 0 23px; font-size: 11px; font-weight: 700; letter-spacing: .03em; text-decoration: none; transition: transform .2s, box-shadow .2s, background .2s; }
.button:hover { transform: translateY(-2px); }
.button-primary { color: white; background: var(--coral); box-shadow: 0 12px 26px rgba(255,133,145,.28); }
.button-primary:hover { box-shadow: 0 15px 30px rgba(255,133,145,.38); }
.button-primary span { font-size: 17px; }
.button-secondary { border-color: rgba(23,63,70,.24); color: var(--navy); background: rgba(255,255,255,.65); }
.button-secondary:hover { background: white; box-shadow: 0 12px 28px rgba(23,63,70,.1); }
.availability { display: flex; align-items: center; gap: 13px; margin-top: 30px; }
.availability-icon { display: grid; width: 39px; height: 39px; place-items: center; border: 1px solid rgba(68,135,143,.18); border-radius: 50%; color: var(--deep-teal); background: white; }
.availability-icon svg { width: 18px; }
.availability p { display: flex; flex-direction: column; gap: 3px; margin: 0; }
.availability strong { font-size: 10px; }
.availability small { color: #798d8f; font-size: 8px; }
.portrait-column { position: relative; padding: 0 15px 22px 0; }
.portrait-accent { position: absolute; top: -22px; right: -8px; width: 76%; height: 84%; border: 1px solid rgba(255,133,145,.28); }
.portrait-card { position: relative; z-index: 2; overflow: hidden; margin: 0; border: 9px solid white; background: var(--navy); box-shadow: 0 28px 60px rgba(23,63,70,.2); }
.portrait-card img { width: 100%; height: 510px; object-fit: cover; object-position: center 20%; }
.portrait-card figcaption { display: flex; align-items: center; gap: 15px; padding: 21px 24px; color: white; background: var(--navy); }
.portrait-card figcaption > span { width: 33px; height: 1px; background: var(--coral); }
.portrait-card figcaption p { display: flex; flex-direction: column; gap: 4px; margin: 0; }
.portrait-card figcaption strong { font-family: 'Playfair Display'; font-size: 14px; }
.portrait-card figcaption small { color: rgba(255,255,255,.6); font-size: 8px; }
.experience-card { position: absolute; z-index: 3; right: -20px; bottom: -18px; display: flex; min-width: 185px; flex-direction: column; gap: 3px; border-left: 3px solid var(--coral); padding: 15px 19px; color: var(--navy); background: white; box-shadow: 0 16px 34px rgba(23,63,70,.16); }
.experience-card strong { font-family: 'Playfair Display'; font-size: 18px; }
.experience-card span { color: var(--muted); font-size: 8px; }

.values { position: relative; z-index: 4; border-block: 1px solid var(--line); background: var(--sand); }
.values-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
.values article { display: flex; align-items: center; gap: 16px; border-right: 1px solid var(--line); padding: 30px 42px; }
.values article:last-child { border-right: 0; }
.value-icon { display: grid; width: 42px; height: 42px; flex: none; place-items: center; border: 1px solid rgba(255,133,145,.3); border-radius: 50%; color: var(--coral); background: rgba(255,255,255,.5); }
.value-icon svg { width: 19px; }
.values h2 { margin-bottom: 4px; font-family: 'DM Sans'; font-size: 13px; letter-spacing: 0; }
.values p { margin: 0; color: var(--muted); font-size: 8px; line-height: 1.55; }

.services-section { background: white; }
.section-intro { margin-bottom: 55px; }
.intro-grid { display: grid; grid-template-columns: 1fr .62fr; align-items: end; gap: 100px; }
.intro-grid h2 { max-width: 650px; }
.intro-grid > p { margin: 0 0 4px; color: var(--muted); font-size: 13px; line-height: 1.75; }
.services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 21px; }
.service-card { overflow: hidden; border: 1px solid var(--line); background: var(--ivory); transition: transform .25s, box-shadow .25s; }
.service-card:hover { transform: translateY(-7px); box-shadow: 0 22px 45px rgba(23,63,70,.12); }
.service-image { position: relative; overflow: hidden; height: 225px; }
.service-image img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s; }
.service-card:hover img { transform: scale(1.04); }
.service-image::after { position: absolute; inset: 0; background: linear-gradient(to top, rgba(16,47,53,.28), transparent 45%); content: ''; }
.service-image > span { position: absolute; z-index: 2; bottom: 14px; left: 19px; color: white; font-family: 'Playfair Display'; font-size: 28px; font-style: italic; }
.service-body { padding: 26px 25px 28px; }
.service-body h3 { margin-bottom: 12px; color: var(--navy); font-family: 'Playfair Display'; font-size: 20px; }
.service-body p { min-height: 62px; margin-bottom: 20px; color: var(--muted); font-size: 10px; line-height: 1.7; }
.service-body a, .text-link { color: var(--deep-teal); font-size: 9px; font-weight: 700; letter-spacing: .08em; text-decoration: none; text-transform: uppercase; }
.service-body a span, .text-link span { margin-left: 5px; color: var(--coral); font-size: 14px; transition: margin .2s; }
.service-body a:hover span, .text-link:hover span { margin-left: 9px; }

.profile-section { position: relative; color: white; background: var(--navy); }
.profile-section::before { position: absolute; inset: 0; opacity: .09; background-image: radial-gradient(white .75px, transparent .75px); background-size: 23px 23px; content: ''; }
.profile-grid { position: relative; display: grid; grid-template-columns: .88fr 1.12fr; align-items: center; gap: 100px; }
.profile-visual { position: relative; max-width: 465px; }
.profile-frame { overflow: hidden; border: 8px solid rgba(255,255,255,.1); height: 490px; }
.profile-frame img { width: 100%; height: 100%; object-fit: cover; object-position: 22% top; }
.signature-card { position: absolute; right: -38px; bottom: -29px; display: flex; align-items: center; gap: 13px; min-width: 220px; padding: 16px 20px; color: var(--navy); background: white; box-shadow: 0 17px 38px rgba(5,27,31,.25); }
.signature-card > span { display: grid; width: 37px; height: 37px; place-items: center; color: white; background: var(--coral); font-family: 'Playfair Display'; font-size: 12px; }
.signature-card p { display: flex; flex-direction: column; gap: 3px; margin: 0; }.signature-card strong { font-family: 'Playfair Display'; font-size: 12px; }.signature-card small { color: var(--muted); font-size: 7px; }
.eyebrow.light { color: rgba(255,255,255,.62); }
.profile-copy h2 { margin-bottom: 27px; }.profile-copy h2 em { color: #ffb3b8; }
.profile-copy > p:not(.eyebrow) { color: rgba(255,255,255,.7); font-size: 13px; line-height: 1.85; }
.profile-points { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 30px 0; }
.profile-points span { display: flex; align-items: center; gap: 9px; color: rgba(255,255,255,.88); font-size: 10px; }
.profile-points i { display: grid; width: 20px; height: 20px; place-items: center; border-radius: 50%; color: white; background: rgba(255,133,145,.25); font-size: 8px; font-style: normal; }
.light-link { color: white; }

.process-section { background: var(--sand); }
.process-heading { display: grid; grid-template-columns: 1fr .55fr; align-items: end; gap: 120px; }
.process-heading > p { margin: 0 0 4px; color: var(--muted); font-size: 13px; line-height: 1.8; }
.process-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 60px; border-top: 1px solid rgba(68,135,143,.25); }
.process-grid article { position: relative; padding: 34px 45px 10px 0; }
.process-grid article::before { position: absolute; top: -4px; left: 0; width: 8px; height: 8px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 5px var(--sand); content: ''; }
.process-grid article > span { display: block; margin-bottom: 29px; color: rgba(68,135,143,.28); font-family: 'Playfair Display'; font-size: 45px; line-height: 1; }
.process-grid h3 { margin-bottom: 11px; color: var(--navy); font-family: 'Playfair Display'; font-size: 18px; }
.process-grid p { max-width: 260px; margin: 0; color: var(--muted); font-size: 10px; line-height: 1.75; }

.statement-section { padding: 75px 0; color: white; background: var(--sage); }
.statement-wrap { display: grid; grid-template-columns: 90px 1fr .42fr; align-items: center; gap: 48px; }
.quote { align-self: start; height: 65px; color: rgba(255,255,255,.35); font-family: 'Playfair Display'; font-size: 100px; line-height: .85; }
.statement-wrap blockquote { margin: 0; font-family: 'Playfair Display'; font-size: clamp(1.6rem, 2.8vw, 2.45rem); font-style: italic; line-height: 1.4; }
.statement-name { display: flex; align-items: center; gap: 13px; }.statement-name > span { width: 35px; height: 1px; background: rgba(255,255,255,.62); }.statement-name p { display: flex; flex-direction: column; gap: 4px; margin: 0; }.statement-name strong { font-size: 10px; }.statement-name small { color: rgba(255,255,255,.65); font-size: 8px; }

.contact-section { background: white; }
.contact-grid { display: grid; grid-template-columns: .72fr 1.28fr; align-items: start; gap: 95px; }
.contact-copy h2 { margin-bottom: 22px; }
.contact-copy > p:not(.eyebrow) { margin-bottom: 30px; color: var(--muted); font-size: 13px; line-height: 1.8; }
.contact-detail { display: flex; align-items: center; gap: 13px; margin-top: 16px; }
.contact-detail > span { display: grid; width: 39px; height: 39px; flex: none; place-items: center; border: 1px solid var(--line); color: var(--deep-teal); background: var(--ivory); }
.contact-detail svg { width: 17px; }
.contact-detail p { display: flex; flex-direction: column; gap: 4px; margin: 0; }.contact-detail small { color: var(--muted); font-size: 8px; }.contact-detail a, .contact-detail strong { color: var(--navy); font-size: 10px; font-weight: 700; text-decoration: none; }
.privacy-note { display: block; max-width: 380px; margin-top: 27px; padding-top: 20px; border-top: 1px solid var(--line); color: #89999a; font-size: 8px; line-height: 1.6; }
.form-panel { min-height: 470px; border: 1px solid var(--line); padding: 39px; background: var(--sand); box-shadow: 13px 13px 0 rgba(239,170,163,.18); }
.form-panel form { display: grid; grid-template-columns: 1fr 1fr; gap: 22px 25px; }
.field { display: flex; flex-direction: column; gap: 7px; }.full-field { grid-column: 1 / -1; }.field label { color: var(--navy); font-size: 9px; font-weight: 700; }.field input, .field textarea, .field select { width: 100%; border: 0; border-bottom: 1px solid rgba(23,63,70,.28); border-radius: 0; padding: 9px 0 11px; color: var(--text); outline: none; background: transparent; font-size: 11px; }.field textarea { resize: vertical; }.field input::placeholder, .field textarea::placeholder { color: #96a1a1; }.field input:focus, .field textarea:focus, .field select:focus { border-color: var(--coral); }.submit-button { justify-self: start; border: 0; cursor: pointer; }.form-panel form > small { align-self: center; color: #8c9a9b; font-size: 7px; line-height: 1.5; }
.success-message { display: flex; min-height: 390px; align-items: center; justify-content: center; flex-direction: column; text-align: center; }.success-message > span { display: grid; width: 56px; height: 56px; margin-bottom: 22px; place-items: center; border-radius: 50%; color: white; background: var(--teal); font-size: 21px; }.success-message h3 { margin-bottom: 12px; color: var(--navy); font-family: 'Playfair Display'; font-size: 25px; }.success-message p { max-width: 390px; color: var(--muted); font-size: 11px; line-height: 1.7; }.success-message button { border: 0; border-bottom: 1px solid var(--deep-teal); padding: 4px; color: var(--deep-teal); background: transparent; font-size: 9px; font-weight: 700; cursor: pointer; }

.footer { color: white; background: var(--navy-deep); }
.footer-main { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 45px; padding-block: 49px; }
.footer .brand-copy strong { color: white; }.footer .brand-copy small { color: rgba(255,255,255,.55); }.footer-brand p { margin: 17px 0 0; color: rgba(255,255,255,.5); font-size: 9px; }
.footer-main nav { display: flex; justify-content: center; gap: 25px; }.footer-main nav a { color: rgba(255,255,255,.6); font-size: 9px; text-decoration: none; }.footer-main nav a:hover { color: white; }
.footer-cta { display: inline-flex; align-items: center; gap: 9px; border: 1px solid rgba(255,255,255,.25); padding: 12px 16px; font-size: 9px; font-weight: 700; text-decoration: none; }.footer-cta span { color: var(--coral); }
.footer-bottom { display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,.1); padding-block: 20px; color: rgba(255,255,255,.37); font-size: 7px; }.footer-bottom div { display: flex; gap: 20px; }.footer-bottom a { color: inherit; text-decoration: none; }

@media (max-width: 960px) {
  .menu-button { display: block; }.main-nav { position: absolute; top: 69px; right: 18px; left: 18px; display: none; flex-direction: column; align-items: stretch; gap: 0; border: 1px solid var(--line); padding: 13px; background: white; box-shadow: 0 20px 40px rgba(23,63,70,.16); }.main-nav.open { display: flex; }.main-nav > a { padding: 14px; }.main-nav > a::after { display: none; }.main-nav .nav-cta { margin-top: 5px; }
  .hero-grid { grid-template-columns: 1fr; gap: 80px; }.hero-copy { max-width: 700px; }.portrait-column { max-width: 650px; }.values article { padding-inline: 21px; }.intro-grid, .process-heading { grid-template-columns: 1fr; gap: 22px; }.intro-grid > p, .process-heading > p { max-width: 650px; }.profile-grid { gap: 65px; }.statement-wrap { grid-template-columns: 70px 1fr; }.statement-name { grid-column: 2; }.contact-grid { grid-template-columns: 1fr; }.contact-copy { max-width: 680px; }.footer-main { grid-template-columns: 1fr auto; }.footer-main nav { grid-row: 2; justify-content: flex-start; }.footer-cta { grid-column: 2; grid-row: 1; }
}

@media (max-width: 700px) {
  .container { width: min(100% - 32px, 560px); }.section { padding: 78px 0; }.nav-wrap { height: 68px; }.brand-copy strong { font-size: 12px; }
  .hero { min-height: auto; padding: 122px 0 82px; }.hero h1 { font-size: clamp(3rem, 14vw, 4.3rem); }.hero-actions .button { width: 100%; }.portrait-card img { height: 420px; }.experience-card { right: -4px; }
  .values-grid { grid-template-columns: 1fr; }.values article { border-right: 0; border-bottom: 1px solid var(--line); padding: 23px 16px; }.values article:last-child { border-bottom: 0; }
  .services-grid { grid-template-columns: 1fr; }.service-body p { min-height: auto; }.profile-grid { grid-template-columns: 1fr; }.profile-visual { max-width: 100%; }.profile-frame { height: 430px; }.signature-card { right: -5px; }.profile-points { grid-template-columns: 1fr; }
  .process-grid { grid-template-columns: 1fr; border-top: 0; }.process-grid article { border-top: 1px solid rgba(68,135,143,.25); }.statement-wrap { grid-template-columns: 1fr; gap: 18px; }.statement-name { grid-column: 1; }.quote { height: 54px; }
  .contact-grid { gap: 55px; }.form-panel { padding: 27px 21px; }.form-panel form { grid-template-columns: 1fr; }.field, .full-field { grid-column: 1; }.submit-button { width: 100%; }.form-panel form > small { text-align: center; }
  .footer-main { grid-template-columns: 1fr; }.footer-main nav { grid-row: auto; flex-wrap: wrap; justify-content: flex-start; }.footer-cta { grid-column: 1; grid-row: auto; justify-self: start; }.footer-bottom { flex-direction: column; gap: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
}

</style>
