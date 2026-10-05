# H09 — Caja: ingresos y egresos

## Acceso y alcance

Nueva opción **Caja** en la navegación principal, ruta `/caja`, visible para Abogada y Administrador. El backend verifica esos permisos en cada operación; ocultar la opción no sustituye la autorización del servidor.

| Categoría | Registro | Asociación |
| --- | --- | --- |
| Trámites | Ingreso recibido | Expediente activo obligatorio |
| Útiles de oficina | Egreso | Compartido con los perfiles autorizados de la oficina |
| Gastos personales | Egreso | Privado del usuario autenticado |

Un ingreso usa el mismo libro de pagos del expediente. Al registrarlo desde Caja también aparece en **Pagos y anticipos**. Utilizar un solo formulario por cobro real; crear dos solicitudes independientes representa dos cobros distintos.

## Pantallas y componentes

- `modules/cash/pages/CashPage.vue`: filtros, resumen, lista de tarjetas, registro y anulación.
- `components/CashMovementForm.vue`: datos y paso de revisión antes de guardar.
- `components/CasePicker.vue`: búsqueda de expedientes activos por nombre, código o DPI; selección del expediente.
- `components/CaseIncomeSummary.vue` y `composables/useIncomeSummary.js`: consulta cancelable y presentación del monto pactado, saldo y pagos finales vigentes junto al expediente seleccionado.
- `domain/cashForm.js`: campos, validaciones, fecha guatemalteca y montos exactos.
- `services/cashApi.js` y `stores/cashStore.js`: contrato HTTP, listado y resumen; descartan respuestas antiguas o posteriores al cierre de sesión.
- `shared/finance/financialSubmissionStore.js`: solicitud financiera pendiente compartida entre Caja y Pagos y anticipos.

Se siguieron `Frontend/context/skills/implementar-frontend/SKILL.md` y `Frontend/docs/ui.md`. Se reutilizan botones, tarjetas, modales, paginación, skeletons y notificaciones existentes. Diseño desde móvil, controles táctiles, etiquetas, foco y navegación de teclado, temas claro y oscuro y colores semánticos. Importes en IBM Plex Mono. No se añaden banners estáticos para las notificaciones: se usan tarjetas flotantes globales con confirmación, advertencia, error y acciones de reintento.

## Flujo de uso

1. Abrir **Caja**. Inicialmente muestra movimientos vigentes desde el primer día del mes hasta hoy en Guatemala.
2. Ajustar fechas, categoría, método de pago, texto de búsqueda y estado. Resumen y lista reciben los mismos filtros; el resumen considera todas las páginas.
3. Pulsar **Registrar movimiento** y elegir categoría.
4. Para Trámites: buscar y seleccionar un expediente activo, consultar monto pactado, abonos, saldo y pagos finales vigentes, y elegir anticipo, abono o pago final. **Usar saldo como pago final** completa el saldo positivo para revisarlo. Para gastos personales: el propietario lo determina el backend.
5. Completar monto, descripción, fecha, método y referencia opcional.
6. Pulsar **Revisar movimiento**, comprobar importe y expediente y **Confirmar y guardar**. La opción **Corregir** permite volver a los datos antes del envío.
7. Al confirmar el servidor: se cierra y limpia el formulario, aparece una tarjeta de éxito y se actualizan movimientos y resumen.
8. Para corregir un movimiento guardado: **Anular**, escribir motivo y confirmar. La fila conserva su historial y deja de contar en el balance. Registrar después los datos correctos si corresponde.

## Validación y exactitud

- Monto positivo hasta `999999999999.99`, hasta dos decimales. Acepta coma o punto decimal, sin separadores de miles.
- Descripción obligatoria; máximo 120 caracteres para ingresos y 500 para gastos.
- Fecha válida, no futura, basada en `America/Guatemala`, independientemente de la zona horaria del teléfono.
- Forma de pago de catálogo y referencia opcional hasta 60 caracteres.
- El registro envía exclusivamente campos editables. No envía propietario, operador, alcance, dirección ni balances calculados.

Los nuevos montos se envían como cadenas decimales. Caja recibe importes y agregados como cadenas y usa `BigInt` para representar/formatear centavos, incluso si el agregado excede el límite exacto de `Number`.

```text
Balance de oficina = ingresos vigentes − gastos de útiles vigentes
Balance general = balance de oficina − gastos personales vigentes de tu cuenta
```

El costo pactado o una cuota por cobrar no se incluye en ingresos. Los anulados aportan cero. Los balances pertenecen al período y filtros elegidos; incluyen transferencias y otros métodos, por lo que no son un arqueo de efectivo físico ni un saldo bancario. Esta versión no registra saldos iniciales, devoluciones de dinero, transferencias internas o conciliación bancaria.

## Respuestas perdidas y sesiones

Cada intención genera un UUID. Un doble clic comparte la misma petición. Ante desconexión, error 5xx o una respuesta exitosa sin confirmación válida:

- Se conservan UUID y contenido original; el formulario queda bloqueado para cambios económicos.
- Se ofrece **Reintentar mismo registro** y se impide crear otro movimiento hasta resolverlo.
- La solicitud permanece en memoria y `sessionStorage` de la pestaña para recuperarse al recargar. No se guarda una segunda lista financiera ni credenciales en ese almacenamiento.
- Caja ofrece **Resolver registro pendiente** o enlace al expediente si el intento nació en Pagos y anticipos.
- El backend confirma el mismo registro cuando recibe el reintento; cambiar importe o usuario con esa clave genera conflicto.

Cerrar sesión o cambiar de cuenta elimina el estado y la copia de la pestaña. No se recuperan gastos privados de otra cuenta; las respuestas tardías tampoco restauran la información. Cerrar definitivamente la pestaña puede eliminar la solicitud pendiente: al regresar, revisar movimientos y el libro del expediente antes de volver a registrar un cobro de resultado desconocido.

La anulación conserva motivo y versión durante un resultado incierto; se bloquea la edición y se ofrece reintento. Una respuesta definitiva desbloquea el diálogo para cancelar o recargar. El cambio de ruta se bloquea durante esa anulación incierta. Para un registro pendiente, abandonar el formulario conserva la intención en el store de la sesión.

No se permite comenzar un nuevo registro cuando el navegador bloquea el almacenamiento de sesión requerido para recuperar la solicitud.

## Integración HTTP

Se reutiliza `httpClient`: Bearer JWT, renovación controlada ante `401` y cierre de sesión si la renovación falla. `403`, `404`, `400` y `409` se presentan mediante tarjetas flotantes. Las búsquedas usan debounce, cancelación y descarte de respuestas antiguas.

| Ruta bajo `/api/v1` | Uso |
| --- | --- |
| `GET /cash` | Resumen y página de movimientos |
| `POST /cash/incomes` | Cobro del expediente |
| `GET /cash/incomes/{caseId}/summary` | Monto pactado, saldo y pagos finales vigentes |
| `POST /cash/expenses` | Gasto de oficina o personal |
| `POST /cash/expenses/{id}/annul` | Anulación de gasto con motivo y versión |
| `POST /cash/incomes/{caseId}/{paymentId}/annul` | Anulación de cobro con motivo y versión |
| `GET /legal-processes` | Búsqueda de expedientes activos |
| `GET /legal-processes/{id}` | Datos del expediente seleccionado |

El catálogo visual de tres categorías corresponde a los códigos fijos del backend, disponible también en `GET /cash/categories`. Configurar `VITE_API_URL` con la URL HTTPS de la API en el despliegue real.

## Verificación realizada

- Compilación de producción correcta con Node 24 y `npm run build`.
- **60 pruebas aprobadas**: Caja y regresiones de pagos, documentos, clientes, expedientes y catálogos.
- Navegador con respuestas simuladas: móvil de 390 px, tablet de 768 px y escritorio de 1440 px; temas claro y oscuro. Registro, revisión/corrección, selección de expediente, limpieza de formulario, pérdida de respuesta, recarga y reintento con exactamente el mismo cuerpo, sin desbordamiento horizontal ni errores de ejecución.
- Suite global: **136 aprobadas y 18 fallos previos de Terrenos**. La copia del código anterior reproduce los mismos 18 fallos, sin las implementaciones H09. No son fallos introducidos por Caja; están pendientes de corrección en ese módulo.
- La revisión visual utilizó una página estática compilada y respuestas interceptadas; no levantó la API ni Docker ni consultó cuentas reales.

```bash
npm run build
node --test --experimental-test-isolation=none \
  tests/cashWorkflow.test.js tests/casePayments.test.js \
  tests/caseDocuments.test.js tests/hu05Workflow.test.js \
  tests/processCatalogApi.test.js
```

Para disponer de Caja, el backend debe tener V10 aplicada. V10 se detiene si hay registros financieros heredados sin conciliar en `expense_record` o `income_record`; revisar la documentación backend `docs/H09_Ingresos_egresos.md` antes del despliegue.

## Corrección: monto pactado y pago final en el registro

Al elegir un expediente para un ingreso, el formulario ahora consulta y muestra **Monto total pactado**, **Abonado hasta ahora** y **Saldo pendiente** junto al expediente seleccionado. La información permanece visible al revisar el cobro, junto con el tipo de cobro seleccionado. Si existe un pago final vigente, muestra **Pago final registrado**, importe recibido y fecha del último pago final. Los pagos anulados quedan excluidos.

Cuando el costo está cubierto se muestra **Monto pactado cubierto**; un sobrepago se identifica como **Saldo a favor del cliente**. Si no hay costo definido, se muestra **Sin pactar** y **Sin definir**, sin inventar un monto final.

La acción **Usar saldo como pago final** completa el monto pendiente y selecciona `PAGO_FINAL`. Solo aparece para saldos positivos de expedientes activos; no cobra ni guarda automáticamente. El formulario mantiene la revisión y confirmación del dinero recibido y los reintentos conservan la misma solicitud.

El resumen utiliza `GET /cash/incomes/{caseId}/summary` y recibe cadenas decimales exactas. Las consultas anteriores se cancelan y se descartan al cambiar de expediente o cerrar el formulario. Un fallo de consulta muestra una tarjeta flotante con reintento y no permite continuar un ingreso nuevo usando un saldo desconocido. Los gastos conservan su formulario habitual.

**Actualizar pagos** permite consultar nuevamente el estado. Si cambian los importes o la disponibilidad del expediente durante la revisión, vuelve al formulario y muestra una advertencia flotante para revisarlos, incluso después de una consulta fallida. No cambia silenciosamente el monto que la abogada ingresó. Esta comprobación visual no reserva el saldo ni sustituye la validación transaccional del backend.

Pruebas de esta corrección: **66 pruebas frontend focalizadas aprobadas**, incluyendo los seis casos nuevos de resumen y las regresiones de los módulos conectados. Compilación de producción correcta. Verificación en navegador con respuestas simuladas para móvil (390 px), tablet (768 px) y escritorio (1440 px), en ambos temas: monto pactado, pago final registrado, costo sin pactar, consulta fallida, reintento, saldo modificado durante la revisión y guardado único con limpieza del formulario. No se inició la API ni Docker.

```bash
node --test --experimental-test-isolation=none \
  tests/cashIncomeSummary.test.js tests/cashWorkflow.test.js \
  tests/casePayments.test.js tests/caseDocuments.test.js \
  tests/hu05Workflow.test.js tests/processCatalogApi.test.js
```
