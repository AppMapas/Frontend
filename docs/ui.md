# UI Color Palette

Esta es la paleta de colores oficial de la interfaz de usuario (UI).

El diseño debe mantener una estética coherente, suave y moderna utilizando exclusivamente estos colores como base visual. No introducir nuevos colores arbitrariamente.

## Paleta principal

| Nombre | HEX | RGB | Uso recomendado |
|---|---|---|---|
| Coral | `#FF8591` | `rgb(255, 133, 145)` | Color de acento principal, CTA, elementos destacados, estados activos |
| Soft Coral | `#EFAAA3` | `rgb(239, 170, 163)` | Acento secundario, fondos suaves, badges, estados hover |
| Sage | `#8CAAA2` | `rgb(140, 170, 162)` | Elementos secundarios, superficies, iconos, estados informativos |
| Teal | `#5A9B95` | `rgb(90, 155, 149)` | Elementos interactivos secundarios, enlaces, botones secundarios |
| Deep Teal | `#44878F` | `rgb(68, 135, 143)` | Elementos de mayor contraste, encabezados/accentos fuertes, estados activos |

## Jerarquía visual

Los colores deben utilizarse siguiendo esta jerarquía:

1. `#FF8591` — acento principal
2. `#EFAAA3` — acento suave
3. `#8CAAA2` — tono neutro/verde suave
4. `#5A9B95` — teal secundario
5. `#44878F` — teal profundo

El color `#FF8591` debe ser el color más llamativo de la interfaz.

Los tonos `#8CAAA2`, `#5A9B95` y `#44878F` deben utilizarse para crear profundidad y contraste sin competir excesivamente con el coral principal.

## Reglas de uso

### Primary

Usar `#FF8591` para:

- Botones principales (CTA)
- Acciones importantes
- Elementos seleccionados
- Indicadores activos
- Highlights
- Elementos que necesitan llamar la atención

```css
--color-primary: #FF8591;
