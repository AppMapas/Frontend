# HU-07: etapas del trámite en el frontend

## Configurar un tipo de trámite

Desde **Trámites → Etapas** se consulta `GET /api/v1/process-types/{id}/stages`.
Cuando la plantilla aún no tiene etapas, el editor propone Presentado →
En revisión → Aprobado → Entregado. La abogada debe guardarlas antes de
publicar. Puede cambiar nombres, códigos, orden y transiciones, añadir o
quitar etapas, elegir la inicial y marcar las finales.

El formulario comprueba los códigos, nombres, límites y caminos del grafo
antes de enviar `PUT /api/v1/process-types/{id}/stages` con la versión
consultada. El backend vuelve a validar todo. Guardar incrementa la versión
de la plantilla. Un conflicto 409 conserva el borrador en pantalla y ofrece
revisar la versión mediante una confirmación antes de recargar. La
publicación usa la nueva versión y solo se habilita tras guardar un flujo
válido. Tanto el catálogo como la edición del trámite recuerdan que hacen
falta etapas antes de publicar.

## Seguir un expediente

El listado muestra la **etapa legal** por separado del estado administrativo.
El detalle muestra las etapas copiadas al abrir el expediente y un historial
de eventos con fecha, usuaria y observación. La línea de tiempo usa los
eventos reales: una etapa visitada más de una vez conserva todas sus visitas
en el historial.

El selector de avance solo presenta los identificadores incluidos en
`allowedNextStageIds`. Una confirmación precede a
`POST /api/v1/legal-processes/{id}/stage-transitions`. El cuerpo incluye
la versión del expediente, el ID de destino, una observación opcional y un
UUID criptográfico. Si la respuesta es incierta por fallo de conexión,
error 5xx o respuesta incompleta, el reintento conserva exactamente el
mismo cuerpo y UUID. Tras un 409 se puede recargar el expediente y elegir
de nuevo. La API valida la transición y registra fecha y usuaria.

Para expedientes anteriores sin etapa, se presentan las etapas vigentes de
la plantilla como vista previa. La abogada selecciona un código y escribe
una observación obligatoria que explique la fase real. Ese primer registro
usa `targetStageCode` y no inventa eventos anteriores. A partir de ahí
se usan los ID copiados al expediente.

Los mensajes de éxito, advertencia y error aparecen como tarjetas flotantes
mediante el sistema global de notificaciones. Cargas y recargas muestran
esqueletos. Los controles y la línea de tiempo se adaptan a móvil, tablet y
escritorio.

## Verificación sin levantar servicios

Con Node compatible con `package.json`:

```bash
node --test tests/hu07Workflow.test.js
npm run build
```

Las pruebas usan respuestas HTTP simuladas. La comprobación de integración
real necesita la migración V8 aplicada por Flyway y una sesión Abogada o
Administrador en un entorno autorizado.
