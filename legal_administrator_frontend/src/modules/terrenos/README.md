# Terrenos: contrato y editor Vue

La ruta `/terrenos` usa componentes Vue y un store Pinia; el HTML público anterior
redirige a esa ruta. No hay iframe, HTML generado mediante innerHTML ni sondeo de altura.
El borrador se conserva al navegar dentro de la sesión, pero no al recargar el navegador.

## Responsabilidades

- `domain/units.js`: catálogo compatible con `UnitConversion.java`, normalización
  y conversiones. El factor común de vara vive en `src/utils/constants.js`: **0.836 m**.
  `1 vara² = 0.698896 m²`. Las unidades desconocidas se rechazan; no se usa factor 1 por defecto.
- `domain/geometry.js`: validación de polígonos simples, reconstrucción por direcciones
  y medidas, área, recorte por calle y transformaciones entre pantalla y metros.
- `domain/calculationContract.js`: construcción de DTO y capacidades del backend actual.
- `services/calculationApi.js`: operaciones HTTP, sin dependencia del lienzo.
- `stores/terrainStore.js`: croquis métrico, medidas originales, metadatos, selección,
  herramienta activa, resultado, subdivisiones e identificadores para la integración futura.
- `components/`: lienzo, herramientas, datos generales, colindancias, resultados y calle.

## Reglas geométricas

Las coordenadas usan metros, X hacia el este e Y hacia el norte. La vista transforma
las coordenadas al canvas; el tamaño de pantalla no modifica las áreas.
El croquis conserva sus direcciones entre cálculos y mantiene el comportamiento
flexible del demo original. Se reconstruyen los vértices con los primeros `n−1` tramos;
el último se utiliza para medir la brecha de cierre. La brecha no bloquea el cálculo:
si supera **0.5 m** se muestra un aviso junto al área estimada. Tampoco se exige una
geometría exacta al cerrar el croquis; los cruces y otros problemas se informan como notas
en la vista previa. Las validaciones estrictas siguen disponibles para los DTO de subdivisión.
El lienzo muestra las medidas originales (incluidas sus unidades y sumas), los ángulos
en las esquinas y el rumbo de la guía. Cerrar el croquis no cambia su escala visual.
Las filas de medidas vacías o no positivas se omiten al sumar el borrador, como antes;
cada lado necesita al menos una medida positiva. Los DTO mantienen su validación estricta.

Los cambios de medida invalidan área y subdivisiones. Volver al trazado conserva las
medidas; deshacer un punto elimina únicamente su colindancia, conservando las restantes.
La calle se modela como una franja de ancho constante sobre una recta que atraviesa
el terreno. Este recorte admite polígonos convexos y exige dos lotes de área positiva;
rechaza terrenos cóncavos para evitar representar regiones desconectadas como un único lote.

## Contrato real del backend (sin modificaciones)

Todos los caminos siguientes son relativos a `VITE_API_URL`, normalmente `/api/v1`.

| Operación | Cuerpo y comportamiento |
| --- | --- |
| `POST /calculations/convert` | Array `{ value, unit }`; nombres canónicos plurales. |
| `POST /calculations/save` | DTO de terreno con DPI como cadenas en el cuerpo. Crea un registro con área **0**. |
| `POST /calculations/polygon` | Mismo DTO. Crea un registro y devuelve 201. Estima el área usando longitudes; no acepta vértices. |
| `POST /calculations/split` | `{ parentCalculationId, splitLines: [{ cutName, points: [{x,y}] }] }`. Cada elemento contiene un polígono resultante completo en metros. Devuelve 201. |
| `GET /calculations/{id}/pdf` | Ruta existente; el esquema del PDF actual es fijo. Descarga pendiente de una fase posterior. |

Los DTO enviados no contienen propiedades del editor ni vértices que el backend no
acepta. No existen `/calculations/area` ni `/calculations/history` en el controlador revisado.
El servicio anterior reexporta la implementación del módulo para mantener una sola fuente.

## Pendiente de las fases posteriores

El editor **no llama a operaciones de guardado**. Convertir y revisar el croquis no debe
crear registros. Los adaptadores HTTP están preparados; la conexión de la interfaz a
clientes, identidad del usuario, conversiones remotas y persistencia corresponde a la fase 4.
No se incluye todavía el rediseño de herramientas por plantillas, rumbos o edición directa (fase 3).

Para completar la fase 1 en el servidor sería necesario admitir/persistir vértices,
calcular el área del polígono real, validar las subdivisiones con respecto al padre,
definir el propósito de `/save`, completar el mapeo de mediciones y dibujar geometría real
en el PDF. Tampoco hay endpoints de edición o recuperación de geometría.
Estas limitaciones siguen vigentes: no se intenta reemplazar el área local por la
estimación del servidor ni presentar la descarga actual como un plano fiel.

## Verificación

Desde `legal_administrator_frontend`: `npm test` y `npm run build`.
