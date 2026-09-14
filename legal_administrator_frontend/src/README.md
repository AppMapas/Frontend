# Organización del frontend

El código se organiza por responsabilidad para que cada funcionalidad tenga una ubicación predecible.

```text
src/
├── app/                    # Arranque transversal de la aplicación
│   ├── layouts/            # Estructuras pública y privada
│   └── router/             # Composición central de rutas
├── modules/                # Funcionalidades agrupadas por dominio
│   ├── landing/
│       ├── pages/
│       └── routes.js
│   └── auth/
│       ├── components/      # Formularios de credenciales y código OTP
│       ├── pages/           # Orquestación de las vistas de acceso
│       ├── services/        # Contrato HTTP de autenticación
│       ├── stores/          # Estado de sesión en Pinia
│       └── routes.js
│   └── terrenos/            # Editor Vue, geometría, contrato y estado del borrador
│       ├── components/
│       ├── domain/
│       ├── pages/
│       ├── services/
│       ├── stores/
│       └── routes.js
├── shared/                 # Código reutilizado por varios módulos
│   └── api/httpClient.js
├── components/             # Componentes existentes pendientes de migrar
├── pages/                  # Páginas existentes pendientes de migrar
├── services/               # Servicios existentes pendientes de migrar
└── styles/                 # Variables y estilos globales
```

## Convenciones

- Una página, servicio o componente específico pertenece a su módulo.
- `shared/` contiene únicamente elementos utilizados por más de un módulo.
- Cada módulo exporta sus rutas desde un archivo `routes.js`.
- `app/router/index.js` compone las rutas, pero no contiene lógica propia de los módulos.
- Las variables de entorno se leen en la capa de configuración o infraestructura; los componentes no construyen URLs del backend.

## API

El editor de terrenos y sus límites de integración se describen en
[`modules/terrenos/README.md`](modules/terrenos/README.md).

`shared/api/httpClient.js` utiliza `VITE_API_URL`. En desarrollo, el valor predeterminado es `http://localhost:8080/api/v1`.

El cliente convierte objetos a JSON, interpreta respuestas JSON o texto y lanza `ApiError` con `status` y `data`. También incorpora el access token, coordina la renovación de sesión ante respuestas `401` y repite la petición original una sola vez.

## Autenticación

El módulo `modules/auth` implementa el login, el desafío 2FA y la renovación del token. Los tokens se mantienen en memoria: al recargar el navegador se debe iniciar sesión nuevamente. Las rutas con `meta.requiresAuth` son verificadas por `app/router/guards.js`.
