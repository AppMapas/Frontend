# HU-05: clientes y expedientes en el frontend

## Pantallas y flujo

| Ruta | Función |
| --- | --- |
| /clientes | Directorio con búsqueda por nombre/DPI, actividad y paginación |
| /clientes/nuevo | Alta con datos personales y catálogos |
| /clientes/:dpi/editar | Consulta y edición con control de versión |
| /expedientes | Listado paginado con búsqueda por código, nombre o DPI |
| /expedientes/nuevo | Apertura con cliente existente o alta simultánea de cliente |
| /expedientes/:id | Datos del caso, requisitos históricos y edición de observaciones |

1. Iniciar sesión como Abogada o Administrador.
2. Registrar un cliente o completar sus datos antiguos.
3. Abrir un expediente, seleccionar un cliente activo y un trámite publicado.
4. Consultar los requisitos antes de guardar; la API conserva su copia histórica.
5. Tras guardar, consultar el detalle o buscar el expediente en el listado.

También se puede registrar el cliente directamente al abrir el expediente. El
frontend envía solo `client` o `clientDpi`; la API realiza la apertura atómica.
La configuración y publicación de plantillas sigue en el módulo de trámites.

## Arquitectura e integración

- Clientes: `src/modules/users/{components,domain,pages,services,stores}`.
- Expedientes: `src/modules/processes`, con rutas en `legalProcessRoutes.js`.
- Formularios, búsqueda paginada y notificaciones comunes: `src/shared`.
- `PrivateLayout` aloja las tarjetas flotantes reutilizando `CatalogToast`.
- Se reutilizan los componentes base y los tokens de los temas claro y oscuro.
- Listados con debounce de 300 ms, cancelación y descarte de respuestas antiguas.
- Formularios etiquetados, controles táctiles de al menos 44 px, skeletons,
  botones de carga y confirmación antes de abandonar cambios sin guardar.

Todos los servicios utilizan el cliente HTTP existente, que añade Bearer,
renueva la sesión ante 401 y la cierra si no puede renovarla. Las rutas y la
navegación muestran las pantallas según el rol; la autorización definitiva
corresponde al backend.

Se consumen `/clients/search`, el CRUD de `/clients`, `/catalogs/*`,
`/process-types?status=PUBLISHED` y `/legal-processes`. Los contratos completos
están en `Backend/legal-administrator/docs/hu05-backend.md`.

## Validaciones y guardado

- DPI como texto de 13 dígitos ASCII; conserva ceros iniciales y no se edita.
- Datos obligatorios: nombres, apellidos, correo, teléfono, nacionalidad,
  estado civil y dirección. Fecha de nacimiento, ocupación y municipio opcionales.
- El servidor comprueba unicidad del DPI y existencia de los catálogos.
- Las ediciones y desactivaciones envían la versión consultada.
- Un 409 conserva el borrador y permite recargar los datos actuales con
  confirmación si se van a reemplazar cambios.
- Aperturas con UUID criptográfico, bloqueo de envíos simultáneos y reintentos
  con el mismo UUID y cuerpo si la respuesta es incierta.
- Mientras el guardado es incierto, el formulario permanece bloqueado y ofrece
  «Reintentar guardado». No se genera automáticamente una nueva solicitud.
- Los datos personales y el cuerpo pendiente permanecen en memoria; no se
  guardan en almacenamiento del navegador. Al cerrar sesión se vacían los stores.
- Recargar o abandonar un guardado incierto pierde el reintento en memoria:
  consultar el listado antes de iniciar otra apertura. La confirmación de salida
  explica este caso.

No se incorporan archivos, pagos ni cambios de etapas. La indicación
«Requiere documentación» describe el requisito, no un archivo almacenado.

## Configuración y comprobaciones

Usar una versión de Node admitida por Vite (por ejemplo Node 24). Configurar
`VITE_API_URL` con la URL de la API y su prefijo `/api/v1`. Para probar desde
un teléfono, usar una dirección accesible desde ese teléfono; `localhost`
apuntaría al propio dispositivo. El origen del frontend debe estar permitido
en `FRONTEND_ALLOWED_ORIGINS` del backend. La base debe incluir la migración V7.

Desde `Frontend/legal_administrator_frontend`:

```bash
npm run build
node --test --experimental-test-isolation=none tests/hu05Workflow.test.js tests/processCatalogApi.test.js
npm test
```

Las 20 pruebas nuevas cubren datos personales, contratos HTTP, JWT/renovación,
paginación, respuestas antiguas, catálogos, versiones, errores y reintentos
idempotentes. Las 6 pruebas existentes del servicio de trámites también pasan.

Se verificaron las seis pantallas en Firefox con respuestas HTTP simuladas
según los contratos del backend: anchos móviles 320/375/414 px, tablet y
escritorio, temas claro/oscuro, sin desbordamiento horizontal. Se comprobaron
alta de clientes, conflicto de edición, apertura con cliente nuevo/existente,
reintento tras pérdida de conexión y edición de observaciones.

La suite completa conserva 18 fallos previos en pruebas de terrenos. Se
reprodujeron ejecutando exclusivamente los archivos de pruebas anteriores:
los cambios de HU-05 no modifican la lógica ni las pruebas de terrenos.

Esta verificación no levantó Docker ni la API real. Antes del despliegue,
comprobar con una cuenta autorizada y la API del entorno:

- Alta/edición y desactivación; DPI duplicado y versión obsoleta.
- Cliente histórico incompleto y plantilla despublicada o modificada.
- Apertura y recuperación real de cliente, expediente y requisitos.
- Renovación de sesión, acceso denegado y cierre de sesión durante una solicitud.

