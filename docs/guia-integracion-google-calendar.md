# Guía de integración con Google Calendar (OAuth 2.0 + Calendar API v3)

Documento de referencia para replicar en otro proyecto una integración ya existente:
un backend **Spring Boot** que expone una API propia de calendario y se encarga de
guardar, cifrar y renovar la credencial de Google de cada usuario, y un frontend
**React** que pinta un calendario y crea eventos.

La guía es deliberadamente agnóstica del proyecto de origen: los nombres de rutas,
variables y clases están "neutralizados" (`backend/`, `frontend/`, `APP_*`). Donde el
nombre original llevaba un prefijo propio de la aplicación, aquí se explica el
mecanismo para que lo reescribas.

---

## 1. Qué hace la integración

- Cada usuario interno **conecta su propia cuenta de Google** una sola vez.
- A partir de ahí puede **ver** los eventos de un **calendario compartido** de la
  empresa y **crear/editar** eventos en él, con participantes y repetición.
- El backend **nunca** recibe la contraseña de Google. Lo único que guarda es el
  *refresh token*, y **cifrado** en la base de datos.
- El frontend **nunca** habla con la API de Calendar de Google: solo con la API
  propia del backend. Los tokens de acceso se emiten y se consumen **en el servidor**.
- También se puede **desconectar**, lo que además revoca el permiso en la cuenta de
  Google del usuario.

### Arquitectura en tres piezas

```
┌──────────────┐   1. popup GIS    ┌───────────────┐   2. code → token    ┌──────────────────┐
│   Navegador  │ ────────────────► │  Google OAuth │ ───────────────────► │  Google Calendar │
│  (frontend)  │ ◄──────────────── │  (consent)    │ ◄─────────────────── │  API v3          │
└──────┬───────┘   authorization  └───────────────┘   refresh_token      └──────────────────┘
       │            code (JS)                            (cifrado en BD)
       │ 3. /api/v1/calendar/google/*  (Bearer de tu app, con cookies)
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Backend Spring Boot                                                        │
│   - valida sesión + rol del usuario                                         │
│   - intercambia el code por tokens en https://oauth2.googleapis.com/token    │
│   - descifra el refresh token, pide un access token, llama a Calendar API    │
│   - devuelve el JSON crudo de Google al frontend                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Modelo de permisos: por qué "authorization code" y no implícito

| Enfoque | Decisión | Motivo |
| --- | --- | --- |
| **Implicit** (`response_type=token`) | **Descartado** | Devuelve el token en el fragmento de la URL y obliga al frontend a hablar con Google. El token acaba en el historial y en el bundle. |
| **Authorization code** | **Usado** | El navegador entrega un `code` de un solo uso. Solo el backend, que tiene el `client_secret`, puede canjearlo. El `client_secret` nunca sale del servidor. |
| **Service account / Clave de cuenta de servicio** | **Descartado** | Los eventos quedarían en el calendario de la cuenta de servicio, no en el del calendario compartido de la empresa, y nadie podría editarlo desde su propia cuenta. |
| **Alcance** | `https://www.googleapis.com/auth/calendar.events` | Es lo mínimo: permite leer y escribir **eventos**, y nada más (no accede a la agenda completa, a correos ni a contactos). |

`access_type: 'offline'` + `prompt: 'consent'` son obligatorios para que Google
entregue el `refresh_token`.

---

## 3. Mapa de archivos

Rutas neutralizadas. Adapta la raíz a la de tu proyecto.

### Backend

```
backend/
├── src/main/java/<paquete>/modules/calendar/
│   ├── controller/GoogleCalendarController.java   # endpoints REST + validación + mapeo de errores
│   ├── service/GoogleCalendarService.java        # OAuth, Calendar API, revocación
│   └── service/GoogleTokenCipher.java             # AES-GCM para el refresh token
├── src/main/resources/
│   ├── application.properties                     # google.calendar.*  ->  variables de entorno
│   └── db/migration/V<N>__add_google_calendar_refresh_token.sql
└── src/main/java/<paquete>/common/
    ├── config/SecurityConfig.java                 # quién puede llamar /api/v1/calendar/**
    └── security/<App>UserDetails.java            # inyecta userId en los métodos
```

### Frontend

```
frontend/
├── src/features/dashboard/pages/CalendarPage.jsx  # la página de calendario (la única que abre/cierra el flujo)
├── src/features/dashboard/pages/<Role>Dashboard.jsx   # segundo consumidor: consulta estado + próximas actividades
├── src/features/dashboard/config/routes.js        # slug "calendario" -> "calendar" -> CalendarPage
└── public/index.html                              # (aquí no se toca nada; el script se carga por JS)
```

> La biblioteca de Google **se carga dinámicamente** desde JS (`loadScript`), no con un
> `<script>` fijo en `index.html`. Así el frontend arranca igual aunque la variable
> `REACT_APP_GOOGLE_CLIENT_ID` no esté configurada, y solo se muestra un aviso.

---

## 4. La API del backend

Base: `/api/v1/calendar/google` · Todos los endpoints usan el `userId` de la sesión
autenticada; **el `userId` nunca viaja en el cuerpo ni en la URL**.

| Método | Ruta | Entrada | Salida | Notas |
| --- | --- | --- | --- | --- |
| `GET` | `/status` | — | `{ "connected": true }` | `true` si el usuario tiene refresh token guardado |
| `POST` | `/connect` | `{ "code": "4/0Ad..." }` + cabeceras | `{ "connected": true }` | Exige `X-Requested-With: XmlHttpRequest`; usa el `Origin` como `redirect_uri` |
| `DELETE` | `/connect` | — | `204 No Content` | Revoca en Google y borra el token local |
| `GET` | `/events?timeMin=&timeMax=` | ISO-8601 dos veces | JSON **crudo** de Google (`{ items: [...] }`) | `singleEvents=true&orderBy=startTime&maxResults=250` |
| `POST` | `/events` | `CalendarEventRequest` | JSON crudo del evento creado | Añade `sendUpdates=all` |
| `PUT` | `/events/{eventId}` | `CalendarEventRequest` | JSON crudo del evento actualizado | Añade `sendUpdates=all` |

### Contratos

**Conectar**
```http
POST /api/v1/calendar/google/connect
Content-Type: application/json
X-Requested-With: XmlHttpRequest
Origin: https://tu-frontend.com

{ "code": "4/0AdONOMtEXAMPLEcode" }
```

**Crear / editar evento**
```jsonc
{
  "summary": "Visita al sitio",          // obligatorio
  "description": "Texto opcional",       // opcional; "" o null se omite
  "start": { "dateTime": "2026-10-05T14:00:00.000Z", "timeZone": "America/Guatemala" },
  "end":   { "dateTime": "2026-10-05T15:00:00.000Z", "timeZone": "America/Guatemala" },
  "recurrence": ["RRULE:FREQ=WEEKLY;UNTIL=20261231T235900Z"],  // opcional
  "attendees": [{ "email": "persona@ejemplo.com" }]            // opcional
}
```

Evento de todo el día (sin hora):
```json
"start": { "date": "2026-10-05" },
"end":   { "date": "2026-10-06" }   // exclusivo: el día siguiente
```

Validaciones declaradas en los `record` del controlador (fallan con `400` y mensaje de
Bean Validation):

| Campo | Regla |
| --- | --- |
| `summary` | `@NotBlank` |
| `start`, `end` | `@NotNull @Valid` (pueden traer `dateTime`, `date` o `timeZone`) |
| `recurrence` | lista de strings RRULE |
| `attendees[].email` | `@NotBlank @Email` |

### Traducción de errores

El servicio lanza dos tipos de excepción y el controlador las traduce:

| Excepción | HTTP | Significado |
| --- | --- | --- |
| `IllegalArgumentException` | `400` | Error del cliente: origen no autorizado, usuario inexistente |
| `IllegalStateException` | `502` | Google falló, o falta configuración en el servidor |

`GET /events`, `POST /events` y `PUT /events/{id}` capturan `IllegalStateException` y
devuelven `502 Bad Gateway` con el mensaje original de Google en el cuerpo. Es
deliberado: si Google está caído no es un error del cliente, y un `500` genérico
perdería el mensaje que explica el motivo (`redirect_uri_mismatch`,
`invalid_grant`, `insufficientPermissions`...).

---

## 5. Variables de entorno

### 5.1 Backend (secretos: solo servidor)

```properties
# application.properties — el puente entre el nombre del .env y el código
google.calendar.client-id=${GOOGLE_CLIENT_ID:}
google.calendar.client-secret=${GOOGLE_CLIENT_SECRET:}
google.calendar.token-encryption-key=${GOOGLE_TOKEN_ENCRYPTION_KEY:}
google.calendar.frontend-origin=${APP_FRONTEND_ORIGIN:http://localhost:3000}
google.calendar.calendar-id=${GOOGLE_CALENDAR_ID:}
```

Todos tienen valor por defecto vacío a propósito: la aplicación **arranca** sin la
integración configurada y falla de forma explícita, con un mensaje que dice qué
variable falta, **en el momento de usarlo**. Es preferible a reventar al arrancar.

`.env` del backend (desarrollo local):

```properties
# ── Google Calendar ──────────────────────────────────────────────
GOOGLE_CLIENT_ID=1234567890-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
# Clave Base64 de EXACTAMENTE 32 bytes. Generarla con:
#   openssl rand -base64 32
GOOGLE_TOKEN_ENCRYPTION_KEY=Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4MTIzNDU2Nzg=
# Origen exacto del frontend (con esquema, SIN barra final).
# Debe coincidir con lo autorizado en Google Cloud.
APP_FRONTEND_ORIGIN=http://localhost:3000
# ID del calendario destino. Puede ser un correo propio, el de un grupo de Google
# o el ID que aparece en la URL de la página del calendario.
GOOGLE_CALENDAR_ID=empresa@group.calendar.google.com
```

> En el proyecto original la variable de origen lleva el prefijo de la aplicación
> (`<PREFIJO_DE_TU_APP>_FRONTEND_ORIGIN`). No es magia: el prefijo evita colisiones cuando el mismo
> `.env` sirve a varios servicios. El nombre importa poco; lo importante es que
> `application.properties` la mapee y que el valor coincida con Google.

### 5.2 Frontend (una sola, y es pública)

```properties
# frontend/.env.local  (o variable de entorno del proyecto en el hosting)
REACT_APP_GOOGLE_CLIENT_ID=1234567890-abcdefghijklmnop.apps.googleusercontent.com
```

**Solo el ID de cliente.** Nunca pongas un `client_secret` en una variable
`REACT_APP_*`: cualquier valor con ese prefijo se compila dentro del bundle y queda
visible en el código fuente de la página. En CRA (`react-scripts`) tampoco existen las
variables sin prefijo: se ignoran silenciosamente y `process.env.MI_VAR` es `undefined`
en el navegador.

### 5.3 Tabla resumen

| Variable | Dónde | Secreto | Sin ella |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Backend | No es secreto, pero solo backend | `502 Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el backend.` |
| `GOOGLE_CLIENT_SECRET` | Backend | **Sí** | Igual que arriba |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Backend | **Sí** | Excepción al guardar/leer el token: `No fue posible proteger la credencial de Google Calendar.` |
| `APP_FRONTEND_ORIGIN` | Backend | No | `400 El origen de la solicitud no está autorizado para conectar Google Calendar.` |
| `GOOGLE_CALENDAR_ID` | Backend | No | `502 Configura GOOGLE_CALENDAR_ID con el ID del calendario compartido.` |
| `REACT_APP_GOOGLE_CLIENT_ID` | Frontend | No | Aviso ámbar en la página: `Falta configurar REACT_APP_GOOGLE_CLIENT_ID`, botón en "Configurando Google..." deshabilitado |

---

## 6. Configuración en Google Cloud (paso a paso)

1. [Google Cloud Console](https://console.cloud.google.com/) → entra con la cuenta que
   administra la integración.
2. Crea un proyecto (o selecciona uno existente).
3. **APIs y servicios → Biblioteca** → busca **Google Calendar API** → **Habilitar**.
4. **APIs y servicios → Pantalla de consentimiento OAuth**:
   - **Externo** si se conectarán cuentas Google personales (lo habitual).
   - Completa nombre de aplicación, correo de soporte y correo del desarrollador.
   - Añade el correo de soporte y el de privacidad.
5. Mientras el estado sea **Pruebas**, en **Google Auth Platform → Público → Usuarios
   de prueba** agrega cada cuenta Google que va a probar (Google documenta un tope de
   100). En la consola nueva esta sección se llama **Público**; en la antigua,
   **Usuarios de prueba**.
6. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth →
   Aplicación web**.
7. En **Orígenes autorizados de JavaScript** agrega, uno por línea y **sin barra
   final**:
   - `http://localhost:3000` (desarrollo)
   - `https://tu-frontend.com` (producción)
   - El origen exacto de cualquier preview que vayas a probar.
8. **No agreges URI de redirección.** Esta integración no usa redirección: el
   `redirect_uri` que se manda al backend es **el propio origen del frontend**,
   y Google lo valida contra la lista de orígenes autorizados de JavaScript. Por eso
   el backend exige que el `Origin` de la petición coincida exactamente con su
   configuración.
9. Pulsa **Crear** y copia el **ID de cliente**. **No copies el secreto de cliente** a
   ningún archivo del frontend.

### Publicar la pantalla de consentimiento

Mientras esté en modo **Pruebas**, solo los usuarios de prueba pueden autorizar.
Cuando la aplicación vaya a usuarios reales:

**Google Auth Platform → Público → Estado** → **Publicar** (o *In production*).
Sin publicar, un usuario fuera de la lista recibe `access_denied` sin explicación útil.

### Compartir el calendario

Como el alcance es `calendar.events`, cada persona que conecte su cuenta **debe tener
permiso de escritura** sobre el calendario configurado en `GOOGLE_CALENDAR_ID`. Si es
un calendario de grupo de Google, hay que añadir a cada persona como **editor**
(compartir →HWANNA mié** en el idioma de la consola: *MiOrganizacion / Organizaciones
de Google* → permiso **Editar eventos**).

---

## 7. Persistencia: la columna en la base de datos

Migración (Flyway), versión `V<N>` correlativa con las existentes:

```sql
-- Credencial duradera de Google Calendar asociada al usuario.
-- El backend guarda el refresh token CIFRADO: nunca en claro.
ALTER TABLE "user"
    ADD COLUMN google_calendar_refresh_token TEXT;
```

Puntos a cuidar:

- **Una fila por usuario**, nunca una tabla aparte: el token pertenece a la identidad.
- **`TEXT`, no `VARCHAR`**: el Base64 de un AES-GCM con nonce es largo y no tiene
  longitud fija.
- **Sin `NOT NULL`**: `null` significa "no conectado", que es un estado legítimo.
- **Nunca en la tabla de sesiones ni en cookies**: es una credencial de largo plazo.

---

## 8. Cifrado del refresh token

`GoogleTokenCipher` es un `@Component` aparte del servicio (se puede testear aislado):

| Detalle | Valor |
| --- | --- |
| Algoritmo | `AES/GCM/NoPadding` (cifrado autenticado) |
| Nonce | 12 bytes aleatorios, `SecureRandom`, **por operación** |
| Tag | 128 bits |
| Formato almacenado | `Base64( nonce ‖ ciphertext+tag )` |
| Clave | `Base64` de **32 bytes**, leída de `GOOGLE_TOKEN_ENCRYPTION_KEY` |

```java
public String encrypt(String value) {
    byte[] nonce = new byte[12];
    random.nextBytes(nonce);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(ECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
    byte[] encrypted = cipher.doFinal(value.getBytes(UTF_8));
    return Base64.getEncoder().encodeToString(
        ByteBuffer.allocate(nonce.length + encrypted.length).put(nonce).put(encrypted).array());
}
```

Cuatro decisiones que importan:

1. **AES-GCM, no AES-CBC ni "cifrado" con Base64.** GCM detecta manipulación: si alguien
   edita un byte de la columna, el descifrado falla en vez de devolver basura.
2. **Nonce aleatorio, no fijo.** Reutilizar el nonce con la misma clave en GCM rompe la
   confidencialidad por completo. Por eso el formato lleva el nonce delante: hace
   falta para descifrar.
3. **Fallo explícito si no hay clave.** El constructor no lanza: el error se produce al
   cifrar o descifrar, con `IllegalStateException` y un mensaje claro. Evita que la app
   no arranque, y garantiza que **ningún token se guarde sin cifrar**.
4. **La clave es externa al código y distinta de la del JWT.** Si alguna vez hay que
   rotarla, cambias la variable y **todo el mundo tiene que volver a conectar**
   (`DELETE /connect` primero, para revocar el permiso viejo en Google).

Generar la clave:

```bash
openssl rand -base64 32
```

Verificarla (debe dar 32):

```bash
echo -n "TU_CLAVE_BASE64" | base64 -d | wc -c
```

---

## 9. El flujo de conexión, paso a paso

### 9.1 El frontend pide el `code`

```javascript
// Carga la biblioteca oficial (una sola vez)
await loadScript('https://accounts.google.com/gsi/client', 'google-identity-services');

const codeClient = window.google.accounts.oauth2.initCodeClient({
    client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    ux_mode: 'popup',          // ventana emergente: no navega fuera de la app
    access_type: 'offline',    // indispensable para obtener refresh_token
    prompt: 'consent',         // indispensable la primera vez
    include_granted_scopes: true,
    callback: async response => {
        if (response.error) { setError(response.error_description || response.error); return; }
        await api.post('/api/v1/calendar/google/connect',
                       { code: response.code },
                       { 'X-Requested-With': 'XmlHttpRequest' });
    },
});

// El botón llama a esto:
codeClient.requestCode();
```

### 9.2 El backend canjea el `code`

```java
MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
form.add("code", code);
form.add("client_id", clientId);
form.add("client_secret", clientSecret);
form.add("redirect_uri", requestOrigin);   // ← el ORIGIN de la petición
form.add("grant_type", "authorization_code");
Map<?, ?> response = postForm("https://oauth2.googleapis.com/token", form);
```

Y guarda el refresh token **solo si viene**:

```java
if (response.get("refresh_token") != null) {
    user.setGoogleCalendarRefreshToken(cipher.encrypt(response.get("refresh_token").toString()));
    users.save(user);
} else if (user.getGoogleCalendarRefreshToken() == null) {
    throw new IllegalStateException(
        "Google no devolvió un refresh token. Desconecta desde los permisos de tu cuenta " +
        "Google y vuelve a autorizar.");
}
```

Ese `else if` es una de las piezas más importantes de todo el flujo. Google **solo**
entrega `refresh_token` la primera vez que se concede el permiso. Si el usuario cancela
a mitad, o si ya tenía concedido ese alcance con `prompt` distinto, la respuesta llega
sin `refresh_token`. Sin ese bloque, el código "conectaría" con éxito y luego fallaría
en el primer `GET /events` con un error incomprensible.

### 9.3 Cada petición posterior renueva el token

No hay caché de tokens: en cada llamada a Google se pide un access token nuevo.

```java
form.add("client_id", clientId);
form.add("client_secret", clientSecret);
form.add("refresh_token", cipher.decrypt(user.getGoogleCalendarRefreshToken()));
form.add("grant_type", "refresh_token");
// → response.get("access_token")
```

Un access token vive ~1 hora, así que en la práctica **nunca expira dentro del proceso**,
y `invalid_grant` solo aparece si el usuario revocó el permiso desde su cuenta.

### 9.4 Las llamadas a Calendar API v3

| Operación | Petición |
| --- | --- |
| Listar | `GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=…&timeMax=…` |
| Crear | `POST .../calendars/{calendarId}/events?sendUpdates=all` |
| Editar | `PUT .../calendars/{calendarId}/events/{eventId}?sendUpdates=all` |
| Revocar | `POST https://oauth2.googleapis.com/revoke` con `token=<refresh token descifrado>` |

Cabecera: `Authorization: Bearer <access token>`. En `RestClient` de Spring 6:

```java
return restClient.get()
    .uri(uriBuilder -> uriBuilder.scheme("https").host("www.googleapis.com")
        .pathSegment("calendar", "v3", "calendars", calendarId, "events")
        .queryParam("timeMin", timeMin).queryParam("timeMax", timeMax)
        .queryParam("singleEvents", true).queryParam("orderBy", "startTime")
        .queryParam("maxResults", 250).build())
    .header("Authorization", "Bearer " + accessToken)
    .retrieve().body(Map.class);
```

Notas de diseño:

- **`singleEvents=true`** expande las recurrencias en instancias individuales. Por eso la
  UI puede pintar cada ocurrencia en su día.
- **`maxResults=250`** es un tope deliberado: la UI solo muestra una semana o un mes, y
  sin tope Google paginaría y traería meses de historia.
- **`sendUpdates=all`** en cada escritura: es lo que hace que **lleguen las invitaciones
  por correo** a los participantes. Sin él los eventos se crean en silencio.
- **Revocar**: aunque Google responda error (p. ej. el permiso ya estaba revocado), el
  acceso local se borra igualmente. El `catch` es deliberado: quedarse "conectado" a un
  permiso que ya no existe deja al usuario en un estado irrecuperable desde la app.
- El controlador **devuelve el JSON crudo de Google** (`Map.class`) en lugar de mapear a
  un DTO propio. Menos código, y el frontend puede leer `event.recurrence`,
  `event.start.dateTime` y `event.start.date` directamente.

---

## 10. Seguridad

### 10.1 Permisos de Spring Security

```java
.requestMatchers("/api/v1/calendar/**").hasAnyRole("ADMIN", "EMPLEADO")
```

Lo importante: **todas** las rutas de calendario, incluida la de conectar y desconectar,
requieren sesión y rol. El `userId` sale de `@AuthenticationPrincipal`, así que un
usuario no puede vincular la cuenta de Google de otro solo manipulando la petición.

### 10.2 Guardia anti-CSRF en `POST /connect`

```java
if (!"XmlHttpRequest".equals(requestedWith)) {
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solicitud OAuth no válida.");
}
```

Un formulario HTML de otro sitio puede mandar un POST a `/connect` con la sesión de la
víctima (las cookies viajan igual). La cabecera `X-Requested-With` **no** la puede poner
un `form` normal, así que su presencia demuestra que la petición salió de un `fetch` de
la propia aplicación. Sin esta línea, un atacante podría meter un `code` suyo y enlazar
su calendario a la cuenta de otra persona.

### 10.3 Validación del `Origin`

```java
if (requestOrigin == null || !frontendOrigin.equals(requestOrigin.replaceAll("/$", ""))) {
    throw new IllegalArgumentException("El origen de la solicitud no está autorizado para conectar Google Calendar.");
}
```

El `Origin` **no** se toma de un cuerpo ni de un parámetro: se lee de la cabecera que
el navegador pone solo, y no se puede forzar desde un `fetch`. Además se compara contra
una lista de un único origen configurado en el servidor, no contra una lista del
cliente. El `replaceAll("/$", "")` tolera la barra final sin abrir la puerta a
`https://dominio.com.evil.com` (esa comparación es exacta, no de prefijo).

### 10.4 CSP y cabeceras de seguridad

El hosting (no la app) debe servir la `Content-Security-Policy`. Con Vercel, en
`vercel.json`:

```jsonc
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Content-Security-Policy", "value":
        "default-src 'self'; " +
        "script-src 'self' https://accounts.google.com; " +
        "connect-src 'self' https://tu-api.com https://www.googleapis.com https://accounts.google.com; " +
        "frame-src https://accounts.google.com; " +
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'" }
    ]
  }]
}
```

| Directiva | Por qué |
| --- | --- |
| `script-src` + `accounts.google.com` | La biblioteca GIS se inyecta como `<script>` desde ese origen |
| `connect-src` + `www.googleapis.com` | La biblioteca habla con Google por XHR/fetch |
| `connect-src` + `accounts.google.com` | La biblioteca pide el token al popup |
| `frame-src` + `accounts.google.com` | El popup de consentimiento se renderiza en un frame en varios navegadores |

**La CSP bloquea la integración de forma silenciosa**: sin `frame-src`, el popup no abre
y no hay error en la consola de la app, solo un aviso del navegador. Es el primer sitio
donde mirar si "no abre nada" en producción y funciona en local.

> El servidor de desarrollo de CRA **no** envía estas cabeceras; por eso el flujo puede
> funcionar en local y romperse en producción con el mismo código.

---

## 11. La página del frontend

La página de calendario es la única que abre y cierra el flujo. Qué hace:

- **Carga diferida** de GIS al montar, e `initCodeClient` si hay `REACT_APP_GOOGLE_CLIENT_ID`.
- **Consulta `/status` al montar** para saber si mostrar "Conectar" o "Desconectar".
- **Vistas**: mes (rejilla de 7 columnas, máx. 3 eventos por día + "+N más") y semana
  (rejilla de 24 horas con eventos posicionados y una línea roja en la hora actual).
- **Navegación**: anterior/siguiente, botón "Hoy", conmutador Mes/Semana.
- **Formulario de evento**: título*, fecha*, todo el día, hora de inicio*, duración en
  minutos*, repetición (`DAILY`/`WEEKLY`/`MONTHLY`/`YEARLY` + "repetir hasta"),
  descripción, y **participantes** (lista de correos; cada uno recibe invitación).
- **Edición**: al pulsar un evento se rellena el formulario con sus valores, incluido el
  `RRULE` y los participantes, y el guardado va por `PUT`.
- **Desconexión**: diálogo de confirmación → `DELETE /connect`.
- **Avisos**: `role="status"` para lo correcto, `role="alert"` para los errores.

Construcción de los valores al guardar:

```javascript
const startsAt = new Date(`${form.date}T${form.time}`);              // hora local del navegador
const endsAt   = new Date(startsAt.getTime() + durationMinutes * 60000);
const recurrence = form.repeatFrequency
    ? [`RRULE:FREQ=${form.repeatFrequency}${form.repeatUntil
        ? `;UNTIL=${new Date(`${form.repeatUntil}T23:59:59`).toISOString()
            .replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}` : ''}`]
    : [];

const payload = {
    summary: form.summary,
    description: form.description || null,
    start: form.allDay ? { date: form.date }
                       : { dateTime: startsAt.toISOString(),
                           timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end:   form.allDay ? { date: localDateKey(endDate) }
                       : { dateTime: endsAt.toISOString(),
                           timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    recurrence,
    attendees: form.attendees.map(email => ({ email })),
};
```

Detalles que no son obvios:

- `dateTime` va **en UTC** (`toISOString()`) y **`timeZone` en la zona del navegador**.
  Con las dos cosas, Google muestra la hora correcta aunque el calendario esté en otra
  zona. Mandar solo `dateTime` en hora local "sin sufijo" produce eventos desplazados.
- Para todo el día, `end.date` es **exclusivo**: un evento de un día va de `2026-10-05`
  a `2026-10-06`. Si se manda el mismo día, Google devuelve un evento de **0 horas**.
- El `UNTIL` del RRULE va en UTC y con formato compacto
  (`AAAAMMDDTHHMMSSZ`); por eso se quitan los `-` y `:` del ISO.
- `description: null` y `recurrence: []` los limpia el controlador antes de enviar
  (un `PUT` de Calendar API **reemplaza** el recurso, no lo mezcla).

### Segundo consumidor: el panel del usuario

El panel consulta `GET /status` y, si está conectado, `GET /events` con la ventana de
los próximos días, para mostrar las actividades venideres y un aviso si no ha conectado:

```javascript
api.get('/api/v1/calendar/google/status').then(s => setCalendarConnected(Boolean(s.connected)));
// luego, solo si connected:
api.get(`/api/v1/calendar/google/events?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}`);
```

Ese segundo consumidor es la razón de que `/status` devuelva algo tan simple como un
booleano: se puede llamar en cada carga del panel sin apenas coste.

---

## 12. Despliegue

### Backend

| Variable | Valor |
| --- | --- |
| `GOOGLE_CLIENT_ID` | ID de cliente OAuth |
| `GOOGLE_CLIENT_SECRET` | Secreto de cliente (**secreto**) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` (**secreto**) |
| `APP_FRONTEND_ORIGIN` | Origen real del frontend, con esquema, sin barra final |
| `GOOGLE_CALENDAR_ID` | ID del calendario compartido |

Además, en producción, el par de la integración debe estar permitido explícitamente en
la configuración de CORS (`setAllowedOrigins`), porque el frontend vive en otro dominio.
Con credenciales (cookie de refresco), un `*` no sirve: el navegador exige origen
explícito.

```java
config.setAllowedOrigins(List.of(appFrontendOrigin));
config.setAllowCredentials(true);
```

### Frontend

| Variable | Valor |
| --- | --- |
| `REACT_APP_GOOGLE_CLIENT_ID` | ID de cliente OAuth (público) |

`REACT_APP_*` se **incrusta en el bundle en tiempo de compilación**: cambiarla exige
recompilar y redesplegar. Reiniciar el servidor de desarrollo no basta.

Marca la variable para **Production, Preview y Development**: si olvidas Preview, cada
preview del pull request saldrá con el aviso "Falta configurar
`REACT_APP_GOOGLE_CLIENT_ID`" y parecerá un bug.

### Orden

1. Backend primero (variables + despliegue).
2. Luego frontend.
3. Al final, **añade el origen del preview** a *Orígenes autorizados de JavaScript* en
   Google Cloud, si vas a probar previews.

Comprobación rápida de que el backend quedó bien configurado, sin navegador:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://tu-api.com/api/v1/calendar/google/status
# 401 = la ruta existe y la seguridad está activa (falta la sesión). 404 = no desplegaste.
```

---

## 13. Verificación end to end

1. Backend arriba con las cinco variables. `GET /status` con sesión devuelve
   `{"connected":false}`.
2. Frontend arriba con `REACT_APP_GOOGLE_CLIENT_ID`; sin aviso ámbar.
3. "Conectar Google Calendar" → se abre el popup → eliges cuenta → consent → la app
   queda conectada y aparecen los eventos.
4. `GET /status` ahora devuelve `{"connected":true}`.
5. Crea un evento con un participante → llega el correo de invitación de Google
   (confirma que `sendUpdates=all` está).
6. Cierra sesión, entra de nuevo: sigue conectado (el refresh token está en la base).
7. "Desconectar" → `GET /status` vuelve a `false` y, al entrar en
   *Seguridad → Aplicaciones de terceros* de la cuenta de Google, ya no aparece la app.
8. Reinicia el backend y repite el paso 6: sigue conectado (el token está cifrado, no
   en memoria).

---

## 14. Problemas frecuentes

| Síntoma | Causa | Qué hacer |
| --- | --- | --- |
| Aviso "Falta configurar `REACT_APP_GOOGLE_CLIENT_ID`" | Variable ausente, o el prefijo no es `REACT_APP_`, o el bundle se compiló sin ella | Añádela y **vuelve a compilar** |
| El botón dice "Configurando Google..." y no hace nada | El script de Google no cargó (CSP, red, bloqueador) | Mira la consola: si dice que viola `script-src`, añade `https://accounts.google.com` |
| El popup no abre | Falta `frame-src https://accounts.google.com` en la CSP | Añádelo a las cabeceras del hosting |
| `400 El origen de la solicitud no está autorizado...` | `APP_FRONTEND_ORIGIN` no coincide con el origen real (barra final, `www`, `http` vs `https`, previews) | Iguala los dos exactamente, sin barra final |
| `403 Solicitud OAuth no válida` | Falta `X-Requested-With: XmlHttpRequest` | Se resuelve al usar el cliente HTTP de la app, no al llamar a la API desde la consola |
| `redirect_uri_mismatch` de Google | El `Origin` que llega no está en *Orígenes autorizados de JavaScript* | Añádelo en Google Cloud (sin barra final) |
| `Google no devolvió un refresh token...` | Google solo lo da la primera vez; hay un permiso previo | Revoca el acceso en *Seguridad → Aplicaciones de terceros* de la cuenta y vuelve a autorizar |
| `access_denied` | Pantalla de consentimiento en modo Pruebas y la cuenta no está en la lista | Añádela a **Público → Usuarios de prueba**, o publica la pantalla |
| `Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el backend` | Variables no llegaron al contenedor | Revisa que estén en el entorno del servicio, no en un `.env` local |
| `Configura GOOGLE_CALENDAR_ID con el ID del calendario compartido` | `GOOGLE_CALENDAR_ID` vacía | Pon el ID del calendario |
| `No fue posible proteger la credencial de Google Calendar` | `GOOGLE_TOKEN_ENCRYPTION_KEY` vacía o no es Base64 de 32 bytes | `openssl rand -base64 32` y verifica con `base64 -d \| wc -c` → 32 |
| `insufficientPermissions` al guardar | La cuenta conectada no tiene permiso de escritura sobre el calendario | Compártelo con ella como **Editar** |
| Los eventos salen corridos de hora | Se manda `dateTime` sin zona, o sin `timeZone` | Manda `dateTime` en UTC **y** `timeZone` |
| Un evento de todo el día dura 0 horas | `end.date` debe ser exclusivo | `end.date` = día siguiente |
| Los correos de invitación no llegan | Falta `sendUpdates=all` | Añádelo a la escritura |

---

## 15. Lecciones y trampas del diseño

1. **El `code` no vale nada sin el `client_secret`.** Ese es el motivo de que el canje
   ocurra en el backend y no en el navegador. No lo muevas al frontend "para simplificar".
2. **`access_type: 'offline'` + `prompt: 'consent'`** son la diferencia entre una
   integración que dura meses y una que se rompe a la hora siguiente.
3. **Guarda el `refresh_token` aunque no venga en la respuesta.** El caso "viene null y
   el usuario ya tenía uno guardado" es el normal en el segundo clic; tratarlo como
   error rompe el botón "conectar" de forma inexplicable.
4. **Devuelve los errores de Google al usuario final.** El texto de
   `invalid_grant` o `redirect_uri_mismatch` ahorra horas. Envolverlos en un 500 genérico
   es una decisión que se paga cada semana.
5. **`singleEvents=true` pierde el id de la serie.** Al editar, un `PUT` afecta **a esa
   instancia**, no a la serie completa; y si le mandas `recurrence` a una instancia,
   Google la convierte en una serie nueva. Si necesitas editar series, hay que usar
   `GET /events/{seriesId}/instances` y `/events/{instanceId}` con `originalEvent`.
6. **Sin caché de tokens** se hace una llamada a `token` por cada operación. Con el
   volumen de un panel es irrelevante; con miles de escrituras, cachea el access token
   hasta ~5 minutos antes de que expire.
7. **Cifra con autenticación (GCM), no solo con cifrado.** Una columna editable a mano
   es un vector de ataque; GCM la convierte en un error de autenticación.
8. **El `client_id` en el frontend no es un secreto**, pero `client_secret` en
   `REACT_APP_*` sí lo es (y es público). La regla de oro: lo que lleve `REACT_APP_`
   puede leer cualquiera que abra las herramientas de desarrollo.

---

## 16. Pruebas recomendadas

En el proyecto de origen este módulo **no tiene pruebas**. Es una deuda conocida, y el
momento de pagarla es al replicarlo en otro sitio. Lo que más rinde, en orden:

| Prueba | Tipo | Qué fija |
| --- | --- | --- |
| Cifrado/descifrado ida y vuelta, y ciphertext distintos para el mismo valor | Unidad (`GoogleTokenCipher`) | Nonce aleatorio, formato `nonce‖ct`, no perder el nonce |
| Descifrar con clave distinta o datos manipulados → excepción | Unidad | Que GCM detecte la manipulación |
| `isConnected` true/false según tenga o no token | Unidad (mock de repositorio) | El caso `null` |
| `connect` guarda el token cifrado; con `refresh_token` ausente **y** token previo, no borra nada | Servicio (mock de `RestClient` + repositorio) | La lección n.º 3 |
| `connect` con `Origin` distinto al configurado → `IllegalArgumentException` | Servicio | El anti-CSRF de origen |
| `POST /connect` sin `X-Requested-With` → 403 | Web (`@WebMvcTest` / MockMvc) | La guardia anti-CSRF |
| `GET /status` → 401 sin sesión, 200 con sesión y rol | Web | La regla de `SecurityConfig` |
| Crear evento: que el cuerpo enviado a Google tenga `summary`, `start` y `timeZone` | Servicio con `RestClient` en modo mock | El contrato con la API de Google |
| Render de la página: aviso ámbar sin `REACT_APP_GOOGLE_CLIENT_ID`, botón "Conectar" con él | Frontend (React Testing Library) | Que la UI degrade bien sin configuración |

Truco para el backend: `RestClient` se puede sustituir por un bean `@TestConfiguration`
con `RestClient.builder().requestFactory(...)` para interceptar peticiones sin red. Es
lo que permite probar el canje OAuth y la llamada a Calendar API sin salir a internet.

---

## 17. Lista de verificación para portar la integración

- [ ] Crear proyecto en Google Cloud y habilitar **Google Calendar API**
- [ ] Configurar la pantalla de consentimiento (Externo) y publicar si habrá usuarios reales
- [ ] Crear credencial **ID de cliente OAuth → Aplicación web**
- [ ] Registrar los orígenes autorizados de JavaScript (dev, prod, previews), sin barra final
- [ ] Anotar el ID de cliente
- [ ] Backend: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_ID`,
      `APP_FRONTEND_ORIGIN` (`openssl rand -base64 32` para la clave de cifrado)
- [ ] Frontend: `REACT_APP_GOOGLE_CLIENT_ID`
- [ ] Migración con la columna del refresh token (TEXT, nullable)
- [ ] Mapper `google.calendar.*` en `application.properties`
- [ ] `SecurityConfig`: las rutas de calendario exigen sesión y rol
- [ ] CSP con `script-src`, `connect-src` y `frame-src` hacia `accounts.google.com` y
      `www.googleapis.com`
- [ ] CORS con el origen del frontend y credenciales habilitadas
- [ ] Compartir el calendario destino con permiso de escritura para quienes se conecten
- [ ] Probar el flujo completo: conectar → ver → crear con participantes → reconectar → desconectar