# Agenda: interfaz y Google Calendar

## Dónde está y qué permite

Abrir **Agenda** en la navegación privada (`/agenda`, Abogada/Administrador). Los expedientes muestran próximas actividades y acceso a su agenda; el cliente puede consultar fechas filtradas. Se mantiene la identidad visual definida por `context/skills/implementar-frontend/SKILL.md` y `docs/ui.md`, con temas claro/oscuro, controles móviles y toasts.

1. **Mes** muestra contadores y resúmenes; seleccionar una fecha abre el resumen del día en un modal. **Semana** muestra horas y eventos de todo el día en escritorio; en móvil permite elegir un día y consultar una lista legible.
2. Los listados usan 25 elementos por página. Filtrar estado, cliente o expediente. **Actualizar** vuelve a consultar ambas fuentes.
3. **Nueva actividad** permite cliente/expediente, horas, notas privadas y repetición diaria, semanal, mensual o anual con fecha fin. Al guardar se confirma con tarjeta flotante y se limpia el formulario.
4. Abrir actividad local para historial, edición, finalización o cancelación con motivo. En una serie, elegir **Solo esta ocurrencia** o **Toda la serie** al editar/cancelar; finalizar siempre aplica a una ocurrencia. Una regla que elimine excepciones anteriores se rechaza.
5. **Conectar Google → Autorizar Google** conecta la cuenta propia con acceso de edición al calendario privado del despacho. Otra usuaria conecta su propia cuenta. Los tokens se canjean y cifran en backend; no se pegan ni se almacenan en el navegador.
6. Eventos creados directamente en ese calendario Google aparecen con su origen. Los vinculados se combinan con su actividad interna sin duplicarse. Los próximos eventos incluyen ambas fuentes, respetando los filtros.
7. Abrir un evento exclusivo de Google → **Editar evento de Google** para modificar título, descripción pública y horas. Una serie permite una ocurrencia o toda la serie. Eventos con invitados o tipos especiales se consultan y se abren en Google Calendar para su gestión; invitados no forman parte de esta entrega.
8. Un horario enlazado distinto muestra **Resolver sincronización**. Elegir conservar el horario interno o aplicar el externo. La versión y el ETag impiden sobrescribir cambios concurrentes. La información privada y el expediente se conservan.

Los eventos exclusivos de Google no se convierten automáticamente en expedientes o registros internos. La actualización ocurre al abrir, pulsar Actualizar y cada 60 segundos con la página visible y sin un editor/detalle abierto; no utiliza webhooks. El navegador muestra la hora de última consulta. Si Google falla, continúan las actividades internas y aparece un toast con reintento.

## Recurrencia y horarios

Las nuevas reglas locales son finitas, hasta 366 días desde el inicio. Los meses sin el día solicitado lo omiten. Se conserva la hora de la zona del evento; el calendario se presenta en Guatemala. Todo el día tiene fin exclusivo a medianoche del día siguiente. Una ocurrencia conserva cliente, expediente, tipo y zona de su serie. La regla se cambia únicamente en el principal. No se implementa «esta y las siguientes».

Reglas Google más complejas se pueden conservar al editar. Si se reemplazan, se usan las frecuencias simples con fin explícito. El formulario distingue descripción pública de Google y notas privadas internas; no introducir información sensible en campos públicos.

## Estados y recuperación

- Guardada en la agenda: existe internamente.
- Pendiente / sincronizada: publicación separada del guardado local.
- Requiere atención: revisar permisos, conexión o reintentos.
- Horario externo por conciliar: elegir explícitamente qué horario conservar.
- **Publicar pendiente con mi cuenta** reasigna una publicación pendiente a la autorización actual con historial. No duplica eventos ya publicados.

Cada usuaria desconecta solamente su cuenta. La desconexión conserva actividades y eventos de Google existentes; sus trabajos pendientes quedan pausados. No detiene las conexiones de otras usuarias. Una misma cuenta Google no puede estar activa en dos cuentas internas simultáneamente.

Una respuesta perdida al guardar conserva el UUID/intento en memoria y, si el navegador lo permite, sessionStorage. Confirmar ese intento reutiliza la solicitud. Logout elimina datos e intentos de las stores e invalida respuestas tardías. Los editores confirman el descarte de cambios; no hay guardado offline.

Los recordatorios de cobro organizan fechas; no registran pagos, ingresos o cambios de etapas/documentos. El formulario público de citas sigue fuera de este flujo.

## Arquitectura y configuración

`src/modules/agenda`: dominio `agenda.js`/`calendar.js`, `agendaApi`, stores, página y componentes modulares `AgendaCalendar`, `AgendaWeekView`, `AgendaEventForm`, `GoogleEventForm`, `GoogleCalendarConnection` y `UpcomingActivities`. Reutiliza formularios/diálogos compartidos, JWT e interceptor HTTP. No añade dependencia de calendario ni nuevas variables VITE.

El documento [Backend: Agenda_Calendar](../../Backend/legal-administrator/docs/Agenda_Calendar.md) explica endpoints, V12, validaciones, cifrado, límites y pasos Google Cloud. Crear cliente OAuth web, habilitar Calendar API y configurar secretos/origen/calendario en backend; después cada usuaria autoriza desde la pantalla. No copiar access tokens ni refresh tokens manualmente. La guía original `guia-integracion-google-calendar.md` se conserva como referencia; la implementación usa la arquitectura Vue/JWT del proyecto.

## Verificación

Con Node `^22.18.0` o `>=24.12.0`:

```bash
npm run build
node --test --experimental-test-isolation=none tests/agendaWorkflow.test.js tests/agendaCalendar.test.js tests/authSessionIdentity.test.js tests/cashWorkflow.test.js tests/hu05Workflow.test.js tests/casePayments.test.js tests/caseDocuments.test.js
```

`tests/browser/agenda.cjs` sirve el build y simula toda la API con Playwright del entorno de pruebas. Revisa 390/768/1440 píxeles, claro/oscuro, mes/semana sin desbordamiento, lista de 25, combinación sin duplicados, edición Google, recurrencia, limpieza e historial. Ejecutar con `node tests/browser/agenda.cjs`; variables opcionales `AGENDA_FRONTEND_DIST`, `PLAYWRIGHT_MODULE` y `PLAYWRIGHT_BROWSERS_PATH`. No inicia Spring Boot ni Docker.

La suite completa contiene fallos previos del módulo Terrenos; se informa por separado del resultado de Agenda. OAuth real y publicación requieren la configuración privada y consentimiento de la licenciada.


## Consulta visual por día

El calendario mensual destaca el día actual con un círculo, la fecha seleccionada con un contorno y los días con actividad con un contador. En tablet y escritorio muestra títulos abreviados; la leyenda distingue actividades del despacho y eventos de Google. La vista semanal conserva sus horarios y añade encabezados de fecha destacados.

Al seleccionar una fecha del mes o un encabezado de día en la semana se abre un resumen en modal. Muestra las actividades que coinciden con ese día según los filtros actuales, con horario, origen y estado. Los eventos enlazados no se duplican y los eventos de todo el día mantienen un fin exclusivo. En móvil, el modal aparece desde la parte inferior.

- Seleccionar una actividad cierra el resumen y abre el detalle existente.
- **Agendar este día** abre el formulario con la fecha seleccionada.
- Una fecha sin actividades muestra un estado vacío y permite agendar.
- Durante una consulta se muestran skeletons. Escape, el botón de cierre y el fondo permiten volver al calendario.
- **Ver listado** despliega la consulta completa con filtros y paginación de 25; empieza cerrado para mantener el calendario a la vista.

El rediseño reutiliza los datos autorizados ya cargados y no añade endpoints ni permisos. Las notificaciones siguen utilizando toasts y los estilos usan los tokens de los temas claro y oscuro.
