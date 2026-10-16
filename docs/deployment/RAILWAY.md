# Despliegue en Railway

## Preparado en el repositorio

- Dos imágenes Docker con Node.js 24; frontend con salida standalone.
- `backend/railway.toml`: migraciones antes de arrancar y healthcheck con PostgreSQL.
- `frontend/railway.toml`: healthcheck por el proxy hasta la base de datos.
- `QA` en GitHub Actions: lint, tipos, unitarias, integración, navegador y auditoría
  de dependencias de producción, construcción de imágenes y comprobación de
  su arranque y salud por proxy. No despliega automáticamente.
- Herramientas manuales de [copia y restauración](BACKUPS.md).

No se necesita Redis, S3, CDN, correo ni otro servicio contratado.

## Configuración de los servicios

Usar el proyecto de Railway existente y PostgreSQL. Crear los dos servicios
desde este repositorio si aún no existen. No duplicar entornos permanentes sin
revisar el presupuesto.

| Ajuste                               | Backend                 | Frontend                  |
| ------------------------------------ | ----------------------- | ------------------------- |
| Root Directory                       | `/backend`              | `/frontend`               |
| Config file, respecto al repositorio | `/backend/railway.toml` | `/frontend/railway.toml`  |
| Builder                              | Dockerfile              | Dockerfile                |
| Puerto del servicio                  | `4000`                  | `3000`                    |
| Exposición                           | Red privada             | Dominio público con HTTPS |
| Healthcheck                          | `/api/v1/health`        | `/api/v1/health`          |

Los Dockerfiles ya definen el comando de arranque. No sobrescribirlo con
`nest start` o `next start`. Configurar `PORT` como indica la tabla o usar el
puerto asignado por Railway, reflejándolo también en `API_INTERNAL_URL`.

Montar el volumen persistente de las fotos en `/app/uploads` del backend.
Una sola instancia del backend: sus archivos se guardan en ese volumen y los
límites de intentos están en memoria. No activar suspensión automática en el
backend: los avisos y cancelaciones se ejecutan cada minuto en ese proceso.
Revisar límites de recursos y consumo en Railway antes de abrir ventas.

## Variables

En backend, completar todas las variables de `backend/.env.example`:

- `NODE_ENV=production`, `PORT=4000`, `LOG_LEVEL=warn` como punto de partida
  económico (los historiales comerciales siguen en PostgreSQL); usar `info`
  temporalmente cuando haga falta diagnosticar peticiones.
- `DATABASE_URL`: referencia privada al PostgreSQL existente. No usar la base de pruebas.
- `PUBLIC_SITE_URL` y `CORS_ORIGINS`: URL HTTPS del dominio real.
- `JWT_SECRET`, `TRACKING_TOKEN_SECRET` e `INTERNAL_API_KEY`: secretos aleatorios,
  de al menos 32 caracteres. Conservar `TRACKING_TOKEN_SECRET`: cambiarlo rompe
  los enlaces de seguimiento existentes.
- `UPLOADS_DIR=/app/uploads`, `MAX_IMAGE_SIZE_MB=5`.
- Plazos confirmados: `ORDER_PENDING_TTL_HOURS=48`, `ORDER_UNPAID_TTL_HOURS=24`,
  `ORDER_PAYMENT_CLARIFICATION_HOURS=8`.
- Sesiones e intentos según `.env.example`.
- `TRUST_PROXY_HOPS`: verificar la cadena Railway → Next.js → API. Para esa
  cadena se parte de 2; comprobar en el entorno real que dos conexiones distintas
  no comparten el límite de intentos. No exponer directamente el backend.
- No definir `TEST_DATABASE_URL` en producción.

En frontend:

- `API_INTERNAL_URL`: URL HTTP privada del servicio backend con su puerto.
- `NEXT_PUBLIC_SITE_URL`: URL HTTPS real de la tienda.
- `INTERNAL_API_KEY`: exactamente la misma del backend, disponible al arrancar.

`API_INTERNAL_URL` y `NEXT_PUBLIC_SITE_URL` deben estar definidas **antes del
build**: las rutas del proxy y los metadatos se fijan al compilar. Cambiarlas
requiere reconstruir la imagen. El build no necesita conectarse a la API ni
recibe claves internas o credenciales de base de datos.

## Datos existentes y primer arranque

La persona usuaria confirmó el 2026-10-16 que los textos legales están aprobados
y cargados en la base. Se verificó su presencia en la base local, sin
marcadores `[PENDIENTE]`. Si Railway usa otra base, comprobar que esos textos y
los datos comerciales estén también allí: el despliegue no copia la base local.
Los borradores de `Context/politicas/` no se cargan automáticamente.

Las migraciones se aplican con `prisma migrate deploy`, nunca con `db push`,
`migrate reset` ni herramientas de pruebas. Antes de intervenir una base con
datos, tomar y descargar una copia.

En una base nueva, ejecutar una vez desde el servicio backend:

```sh
npm run db:seed
```

Para crear la propietaria, definir previamente `SEED_OWNER_EMAIL`,
`SEED_OWNER_NAME` y `SEED_OWNER_PASSWORD` (mínimo 12 caracteres). Después borrar
`SEED_OWNER_PASSWORD`. El seed no sobrescribe la configuración ni una cuenta
ADMIN existente. No ejecutar `db:demo` en producción.

## Comprobación antes de abrir ventas

1. Subir el commit revisado y comprobar que `QA` esté verde en GitHub Actions.
2. Desplegar backend y frontend, comprobar ambos healthchecks y revisar logs.
3. Verificar inicio, catálogo, fotos, favoritos y acceso al panel con HTTPS.
4. Verificar los cuatro textos legales, WhatsApp e instrucciones de pago reales.
5. En un entorno de validación, completar un pedido y su gestión con datos
   ficticios; comprobar seguimiento, permisos y cancelaciones.
6. Comprobar persistencia de una foto después de redesplegar el backend.
7. Repetir la medición de rendimiento en Railway y acordar la carga aceptada.
8. Descargar una copia y verificar su restauración en una base aislada.

La medición local no certifica los recursos de Railway. Los 147 seguidores
indicados por la persona usuaria orientan el tamaño inicial, pero no equivalen
a una cifra confirmada de conexiones simultáneas.
El 2026-10-16 se aprobaron estas metas iniciales: p95 ≤ 1,5 s para búsqueda/ofertas
con 20 conexiones y p95 ≤ 1 s para catálogo con 50 conexiones. Se cumplieron
localmente con 2.000 productos; repetirlas en Railway antes de abrir ventas.

## Medición reproducible

`backend/perf/seed.ts` carga solo datos ficticios en una base PostgreSQL
`*_test` vacía de productos y pedidos; no borra datos. Migrar primero esa base.
Desde `backend/`, usando variables del entorno de pruebas:

```sh
npm run perf:seed -- 2000
npm run perf:measure
```

El seed toma `PERF_DATABASE_URL`. La medición toma `PERF_BASE_URL`,
`PERF_CONNECTIONS` (20 por defecto), `PERF_SECONDS` (60 por defecto),
`PERF_PATHS` y, opcionalmente, `INTERNAL_API_KEY` para medir sin el limitador.
No compartir esa clave ni enviarla desde el navegador.
Para BE-227 usar 50 conexiones y `PERF_PATHS=/api/v1/store/products?page=1&limit=20`.
Para BE-228 se alternan búsqueda y ofertas por defecto. El resultado incluye
p50, p95, p99, peticiones por segundo, errores y códigos HTTP.

Fuentes técnicas: [configuración como código](https://docs.railway.com/config-as-code/reference),
[Dockerfiles y variables de build](https://docs.railway.com/builds/dockerfiles),
[pre-deploy](https://docs.railway.com/deployments/pre-deploy-command) y
[healthchecks](https://docs.railway.com/deployments/healthchecks).
