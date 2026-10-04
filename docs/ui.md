# Guía de color de la interfaz

La identidad de LegalAdministrator combina verde azulado, coral y fondos claros. La aplicación de gestión debe transmitir claridad y confianza: el **teal oscuro es el color principal de las acciones** y el **coral es un acento de marca puntual**. Esta jerarquía también orienta las nuevas secciones del sitio público.

Los valores siguientes provienen del diseño actual. En el código, utiliza los tokens de `legal_administrator_frontend/src/styles/variables.css` para que los componentes respondan a los temas claro y oscuro.

## Paleta y jerarquía

| Función | Color | HEX en tema claro | Uso |
|---|---|---|---|
| Acción principal | Teal oscuro | `#326B72` | Botones principales y controles activos. Token: `--color-primary`. |
| Acción principal hover | Teal más profundo | `#25565D` | Hover de la acción principal. Token: `--color-primary-hover`. |
| Base de marca | Teal profundo | `#44878F` | Iconografía, datos destacados y elementos de apoyo. |
| Acción secundaria | Teal | `#5A9B95` | Botones secundarios y controles de menor prioridad. Token: `--color-secondary`. |
| Apoyo visual | Salvia | `#8CAAA2` | Bordes, divisores y superficies suaves. |
| Acento cálido | Coral | `#FF8591` | Detalles decorativos, subrayados, ilustraciones y énfasis breves. |
| Acento cálido suave | Coral suave | `#EFAAA3` | Fondos y detalles cálidos de baja intensidad. |
| Titulares públicos | Azul petróleo | `#173F46` | Títulos, áreas oscuras y CTA del sitio público. |

El teal oscuro debe dirigir las acciones y dar continuidad visual a la aplicación. Usa el coral con moderación para aportar calidez y distinguir detalles; evita convertirlo en el color dominante de botones, navegación o grandes superficies. En cada grupo de acciones, destaca una sola opción principal.

## Superficies y texto

| Función | HEX en tema claro | Token o ubicación |
|---|---|---|
| Fondo de la aplicación | `#F2F6F5` | `--color-bg-body` |
| Tarjetas | `#FFFFFF` | `--color-bg-card` |
| Títulos de la aplicación | `#173033` | `--color-text-title` |
| Texto general | `#293F3E` | `--color-text-body` |
| Texto secundario | `#566B69` | `--color-text-muted` |
| Fondo del sitio público | `#FFFAF7` | `--ivory` en `LandingPage.vue` |

Mantén fondos neutros y suficiente espacio entre bloques. Reserva las sombras y los acentos intensos para reforzar la jerarquía, no para decorar todos los elementos.

## Uso en componentes

- **Botón principal:** `background: var(--color-primary)` y `color: var(--color-text-on-primary)`; utiliza los tokens de hover y activo definidos en `variables.css`.
- **Botón secundario:** usa `--color-secondary` con `--color-text-on-secondary`, o un botón de contorno cuando la acción tenga menor prioridad.
- **Enlaces y foco:** verifica su contraste sobre la superficie real. Mantén un indicador de foco visible y no dependas sólo del color para comunicar estados.
- **Éxito, advertencia, error e información:** usa `--color-success`, `--color-warning`, `--color-danger` y `--color-info`; acompaña el color con texto o icono.
- **Sitio público:** conserva la tipografía y el carácter editorial existentes. Para nuevos CTA con texto blanco, prefiere el azul petróleo o un teal oscuro; deja el coral para detalles.

El coral `#FF8591` con texto blanco tiene un contraste aproximado de **2.33:1**, insuficiente para texto normal. Usa texto oscuro sobre coral cuando el diseño requiera ese fondo, o elige un fondo oscuro con texto blanco. Como referencia, `#173F46` sobre `#FF8591` alcanza aproximadamente **4.91:1**. Comprueba cada combinación final: al menos **4.5:1** para texto normal y **3:1** para texto grande.

## Tema oscuro

Los componentes de la aplicación deben usar los mismos tokens semánticos; `[data-theme='dark']` ya cambia sus valores. En ese tema, `--color-bg-body` es `#0F1719`, `--color-bg-card` es `#151F22`, `--color-text-title` es `#F1F7F6` y `--color-primary` es `#39747B`. No fijes los HEX del tema claro dentro de componentes que deban funcionar en ambos temas. La página pública conserva su estilo propio salvo que se solicite expresamente un tema oscuro.
