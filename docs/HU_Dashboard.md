# Dashboard: Inicio del despacho

## Alcance

La nueva opción **Inicio**, ruta `/inicio`, presenta un resumen operativo
responsivo con superficies azules, violetas, ámbar, coral y verde azulado,
usando los tokens existentes de los temas claro y oscuro.

Incluye expedientes activos, actividades internas de hoy, recordatorios de
cobro agendados, gráfico de los próximos siete días y eventos externos de Google
Calendar de hoy. **Montos, saldos, comparativos de ingresos/egresos y alertas
basadas en deuda están pendientes.** El gráfico representa actividades, no
información financiera. Caja y pagos conservan sus pantallas y servicios.

## Flujo de la abogada

1. Al iniciar sesión, con o sin segundo factor, llega a Inicio. Si había abierto
   previamente una ruta privada autorizada, regresa a ella. Administradores
   también tienen Inicio; otros roles conservan su destino Terrenos.
2. Consulta las tarjetas. Expedientes abre su listado; actividades abre Agenda
   en la fecha correspondiente; recordatorios abre un modal filtrado.
3. Consulta la vista previa de agenda (hasta ocho actividades), y pulsa una para
   abrir su detalle en Agenda, incluyendo la ocurrencia correcta de una serie.
4. Abre todos los recordatorios, filtra hoy/próximos/sin atender y pagina de diez
   en diez. Pulsa uno para revisarlo y atenderlo en el flujo existente de Agenda.
5. Pulsa una barra del gráfico para consultar ese día. El gráfico incluye hoy
   y los seis siguientes; una actividad de varios días cuenta en cada día ocupado.
6. Consulta Google en su tarjeta independiente. Solo muestra eventos externos
   sin enlace local; los enlazados y su conciliación se consultan en Agenda.
7. Usa **Actualizar resumen** o vuelve a Inicio para obtener información nueva.

Los recordatorios son actividades `PAYMENT_REMINDER` todavía `SCHEDULED`,
no una afirmación de deuda. Por atender abarca los treinta días anteriores,
no toda la historia. Completar, cancelar o reprogramar se realiza en Agenda;
registrar un pago no modifica automáticamente el estado del recordatorio.

## Estructura modular

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `src/modules/dashboard/routes.js` | Ruta privada de oficina. |
| `pages/DashboardPage.vue` | Carga, composición de la pantalla y navegación. |
| `components/DashboardStat.vue` | Tarjeta de indicador con acceso directo. |
| `components/DashboardWeekChart.vue` | Gráfico accesible de siete días. |
| `components/DashboardReminders.vue` | Modal de filtros y paginación. |
| `stores/dashboardStore.js` | Resumen y carga independiente de Google, solo en memoria. |
| `services/dashboardApi.js` | Consultas mediante el cliente HTTP autenticado compartido. |
| `domain/dashboard.js` | Validación de respuestas y destinos internos. |
| `src/shared/auth/homeRedirect.js` | Inicio por rol y validación de accesos directos. |
| `src/shared/date/calendarDay.js` | Validación de fechas del dashboard y Agenda. |

Se reutilizan BaseCard, BaseButton, BaseModal, LoadingCards, ListPagination y
notificaciones flotantes del proyecto. Agenda ahora reconoce los parámetros
`day`, `activity`, `originalStartsAt` y `googleEvent`; la consulta del detalle
sigue usando sus endpoints existentes y su autorización del servidor.

## Integración y estados

- `GET /api/v1/dashboard/summary`: conteos completos, vistas previas, límites
  temporales, fecha del despacho y momento de generación.
- `GET /api/v1/dashboard/reminders?kind=TODAY&page=0&size=10`: listado paginado;
  omitir `kind` consulta todos. Los límites y enums se validan en el backend.
- Google usa `/agenda/google/status` y `/agenda/google/events` existentes;
  no se agregan tokens de proveedor al navegador ni nuevas variables de entorno.
- La fecha de Guatemala recibida del servidor define el rango de Google de hoy,
  aunque el dispositivo tenga otra zona. El fin del rango es exclusivo.
- El resumen y Google se cargan por separado. Un fallo de Google no oculta las
  tarjetas locales. Se completan sus páginas, se eliminan duplicados por ID y se
  rechazan cursores repetidos; se limita la carga a cuarenta páginas de hasta 250.
- Hay skeletons, estados vacíos, botones para reintentar y errores/success mediante
  toasts. Si una actualización falla, se conserva el último resumen y se rotula
  con su fecha; no se presenta un cero inventado. Un 401/403 borra ese resumen.
- La pantalla actualiza cada minuto cuando está visible, no hay carga pendiente
  y el modal de recordatorios está cerrado. Volver a una pestaña visible también
  permite refrescar. Se desmontan temporizadores y escuchadores al salir.
- Al cambiar de sesión se abortan consultas y se invalidan respuestas tardías;
  los datos del dashboard no se guardan en localStorage. No se incorporan montos,
  notas privadas ni DPI a los contratos del resumen.

La seguridad efectiva está en el backend: JWT, roles de oficina y verificación
del rol actual con OfficeAccess. Los guardas Vue ayudan a la navegación y no
sustituyen esos controles.

## Pruebas

- `tests/dashboardWorkflow.test.js`: ocho pruebas de destinos por rol, fechas,
  respuestas inválidas, fallos parciales, paginación/deduplicación de Google,
  cierre de sesión, solicitudes simultáneas y datos obsoletos identificados.
- `tests/browser/dashboard.cjs`: Playwright con API simulada y servidor temporal
  de archivos del build; móvil 390 px, tablet 768 px y escritorio 1440 px en ambos
  temas. Verifica navegación, paginación, errores independientes, accesos a
  detalles y ausencia de desbordamiento. Incluye login normal, segundo factor y
  conservación de un destino autorizado.
- El build de producción se realizó con Node 24. Node 18 no cumple los engines
  actuales del proyecto.

Ejecutar desde `Frontend/legal_administrator_frontend` con una versión admitida
por `package.json`:

```bash
npm run build
node --test --experimental-test-isolation=none tests/dashboardWorkflow.test.js tests/agendaCalendar.test.js tests/agendaWorkflow.test.js tests/authSessionIdentity.test.js
```

Para la prueba visual, Playwright y Chromium deben estar instalados. Puede
indicarse su instalación externa con `PLAYWRIGHT_MODULE` sin agregarlo como
una dependencia del producto:

```bash
PLAYWRIGHT_MODULE=/ruta/a/playwright DASHBOARD_WIDTHS=390,768,1440 DASHBOARD_LOGIN=true node tests/browser/dashboard.cjs
```

No se inició la API ni Docker para estas verificaciones. Google y backend se
simularon en el navegador; falta verificarlos en un entorno real configurado.
La suite completa tuvo 175 pruebas correctas y 18 fallos existentes de Terrenos;
antes del dashboard daba 167 correctas y los mismos 18 fallos. La suite dirigida
al dashboard, Agenda e identidad de sesión pasa sus 33 pruebas.
