---
name: implementar-frontend
description: Implementar o mejorar interfaces del frontend Vue de LegalAdministrator siguiendo su identidad visual, paleta, componentes y temas existentes. Úsala para páginas, componentes y ajustes de interfaz de este proyecto; no aplica al backend ni a cambios puramente de lógica de negocio.
---

# Frontend de LegalAdministrator

Esta skill guía cambios en `Frontend/legal_administrator_frontend`. La interfaz tiene dos contextos: el sitio público de la abogada y la aplicación interna de gestión jurídica y topográfica. Conserva su identidad común, pero respeta la estructura y las necesidades de cada contexto.

## Antes de implementar

1. Lee la pantalla o componente afectado y los componentes compartidos que ya resuelvan el mismo patrón. El proyecto usa Vue 3, Vite, Vue Router y Pinia.
2. Consulta `Frontend/docs/ui.md` para la jerarquía visual y `src/styles/variables.css` y `src/styles/main.css` para los tokens vigentes de los temas claro y oscuro. Si una pantalla antigua todavía usa coral como CTA con texto blanco, al modificar esa pantalla alinéala con la guía de color dentro del alcance solicitado.
3. Reutiliza `src/components/common` cuando corresponda, en especial `BaseButton`, `BaseCard`, `BaseBadge`, `BaseModal` y `PageHeader`. Mantén el patrón de rutas, servicios y estados del módulo que estés editando.

## Dirección visual

La identidad combina verde azulado sobrio, coral cálido y superficies claras. En las acciones y la navegación, el verde azulado oscuro aporta confianza y legibilidad; el coral funciona como acento editorial, indicador y detalle de marca. Usa jerarquía por tamaño, espacio y peso tipográfico antes de agregar más color, bordes o sombras. Evita que todos los elementos compitan por atención.

La página pública usa una expresión más editorial: fondo marfil, títulos Playfair Display y texto DM Sans. La aplicación interna usa Inter y, para datos o medidas, IBM Plex Mono. Mantén esta distinción al ampliar cada zona; no mezcles las fuentes dentro de un mismo tipo de componente sin motivo.

### Paleta de marca y uso

| Color | HEX actual | Uso recomendado |
|---|---|---|
| Coral | `#FF8591` | Detalles, subrayados, iconos decorativos y énfasis breves; evitar texto blanco encima. |
| Coral suave | `#EFAAA3` | Fondos o acentos cálidos discretos. |
| Salvia | `#8CAAA2` | Bordes, separadores y apoyos visuales. |
| Teal | `#5A9B95` | Controles secundarios y elementos informativos. |
| Teal profundo | `#44878F` | Énfasis, iconografía y enlaces según contraste. |
| Teal de acción | `#326B72` | Acción principal en tema claro; usar `var(--color-primary)`. |
| Teal de acción hover | `#25565D` | Hover de acción principal; usar `var(--color-primary-hover)`. |
| Azul petróleo | `#173F46` | Titulares y áreas oscuras del sitio público. |
| Marfil | `#FFFAF7` | Fondo del sitio público. |
| Fondo de aplicación | `#F2F6F5` | Fondo general en tema claro; usar `var(--color-bg-body)`. |
| Blanco | `#FFFFFF` | Tarjetas y superficies elevadas; usar `var(--color-bg-card)`. |
| Texto principal | `#173033` | Titulares de la aplicación; usar `var(--color-text-title)`. |
| Texto general | `#293F3E` | Párrafos y controles; usar `var(--color-text-body)`. |
| Texto secundario | `#566B69` | Ayuda y metadatos; usar `var(--color-text-muted)`. |

Los HEX documentan la identidad actual. En componentes nuevos, usa los tokens semánticos de `variables.css` en vez de copiar valores hexadecimales. Para el sitio público, reutiliza primero los alias locales de `LandingPage.vue` (`--coral`, `--navy`, `--ivory`, etc.) y extrae un token compartido si varias pantallas públicas lo necesitan. Si un color nuevo es indispensable, define su función y sus variantes de tema en `variables.css`.

### Jerarquía y estados

- **Acción principal:** `--color-primary` con `--color-text-on-primary`; hover y activo mediante sus tokens. En el sitio público, el azul petróleo puede cumplir la misma función.
- **Acción secundaria:** botón de contorno o `--color-secondary` con `--color-text-on-secondary`. Mantén una sola acción principal por grupo de decisiones.
- **Coral:** úsalo como acento visual, no como color de texto pequeño sobre fondo claro ni como fondo con texto blanco. El coral `#FF8591` con blanco tiene contraste aproximado de **2.33:1**. Si se requiere texto sobre coral, el azul petróleo `#173F46` alcanza aproximadamente **4.91:1**; comprueba el estado final en contexto.
- **Estados:** usa `--color-success`, `--color-warning`, `--color-danger` y `--color-info` junto con texto o iconos que expresen el significado. No dependas únicamente del color.
- **Tema oscuro:** utiliza los mismos nombres de tokens; `[data-theme='dark']` ya define superficies, texto, acciones, estados y colores del plano. Asegura que nuevos componentes se lean en ambos temas. La página pública actual tiene estilo propio y no requiere oscurecerse salvo que la tarea lo pida.

## Implementación de pantallas

- Prioriza una composición clara: título y contexto, acción principal, contenido, estados de carga, vacío y error cuando correspondan. Conserva datos, rutas y comportamiento existentes salvo que el cambio solicitado los afecte.
- Usa la escala de espaciado, radios, sombras y transiciones de `variables.css`; prefiere espacios consistentes y bordes sutiles a capas decorativas innecesarias.
- En páginas internas, reutiliza el ancho, la navegación y el marco de `PrivateLayout.vue`. En páginas públicas, conserva el ritmo editorial y las imágenes reales disponibles en `public/`.
- Diseña para móvil desde el mismo componente: evita desbordamiento horizontal, deja formularios y acciones utilizables, y comprueba la navegación con teclado. Los textos de interacción deben ser legibles; no copies los tamaños de 7–10 px presentes en algunas secciones antiguas como patrón para contenido nuevo.
- Etiqueta entradas y controles, mantén foco visible y verifica contraste mínimo de 4.5:1 para texto normal y 3:1 para texto grande y límites de controles importantes. Respeta `prefers-reduced-motion` si agregas animación.
- Mantén estilos cerca del componente cuando sean locales; usa estilos globales sólo para tokens y patrones realmente compartidos. Evita HEX arbitrarios o duplicar componentes existentes.

## Comprobación al terminar

Revisa la pantalla afectada en anchos móvil y escritorio y, para páginas internas, en temas claro y oscuro. Verifica estados de foco, hover, error y carga que existan. Ejecuta `npm run build` desde `Frontend/legal_administrator_frontend`; ejecuta pruebas adicionales sólo si cambiaste comportamiento cubierto por ellas. Resume los cambios y cualquier limitación visible.
