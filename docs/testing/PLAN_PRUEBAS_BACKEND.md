# Plan de pruebas del backend — Sky Beauty Maquillaje

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-10-15 |
| Rama analizada | `dev` (commit `aaa2566`) |
| Alcance | API REST `backend/` (NestJS + Prisma + PostgreSQL) |
| Documentos relacionados | [`PLAN_MAESTRO_QA.md`](PLAN_MAESTRO_QA.md) (riesgos `R-xx`, hallazgos `H-xx`, preguntas `Q-xx`, escenarios `E2E-xx`) · [`PLAN_PRUEBAS_FRONTEND.md`](PLAN_PRUEBAS_FRONTEND.md) (casos `FE-xxx`) |
| Fuentes de reglas | `Context/negocio.md`, `Context/decisiones.md` (prevalece), `Context/plan-desarrollo.md` |

> **Regla de este plan.** Cada resultado esperado sale de `Context/` o del comportamiento verificado en el código. Cuando el código hace algo que el contexto no decide, el caso se marca como **caracterización** (documenta el comportamiento actual) y remite a una pregunta abierta `Q-xx`. Ningún caso se reporta como aprobado o fallido: el estado es **Pendiente**, **Bloqueado** o **No aplicable** hasta que se ejecute.

---

## A. Análisis de arquitectura

### A.1 Framework y lenguaje

| Elemento | Tecnología verificada | Archivo |
|---|---|---|
| Lenguaje | TypeScript 5.9.3 | `backend/package.json` |
| Framework | NestJS 11.2.7 (Express) | `src/main.ts`, `src/app.module.ts` |
| ORM | Prisma 7.10.0 con `@prisma/adapter-pg` | `prisma/schema.prisma`, `src/shared/prisma/` |
| Base de datos | PostgreSQL 17 (Docker local) | `docker-compose.yml` |
| Validación de entrada | `class-validator` + `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) | `src/app.module.ts` |
| Validación de entorno | `zod` 4 | `src/config/env.ts` |
| Autenticación | Cookie `sb_admin_session` (httpOnly, SameSite=Lax, Secure en producción) con JWT que solo lleva el id de `AdminSession` | `src/modules/auth/` |
| Contraseñas | `argon2id`, mínimo 12 caracteres | `src/shared/security/password.ts` |
| Seguridad HTTP | `helmet`, CORS por lista, `@nestjs/throttler` (120 req/min por IP) | `src/app.setup.ts`, `src/app.module.ts` |
| Tareas programadas | `@nestjs/schedule` (ciclo de plazos cada minuto con bloqueo `pg_try_advisory_xact_lock`; limpieza de sesiones diaria) | `src/modules/notices/notices.service.ts`, `src/modules/auth/session.service.ts` |
| Imágenes | `sharp` → WebP en disco (`UPLOADS_DIR`), servidas en `/uploads` | `src/modules/catalog/products/products.service.ts` |
| Logs | `nestjs-pino` con redacción de cookie, `authorization` y `x-internal-api-key` | `src/app.module.ts` |
| Documentación API | Swagger en `/api/v1/docs` (deshabilitado en producción) | `src/app.setup.ts` |
| Pruebas | Jest 30 + ts-jest, Supertest, `@nestjs/testing` | `package.json`, `test/jest-e2e.json` |

### A.2 Organización del backend

```text
backend/
├── prisma/
│   ├── schema.prisma            # 30 modelos, enums de estados
│   ├── migrations/              # 19 migraciones (incluye CHECK constraints y datos DIVIPOLA)
│   ├── seed.ts                  # datos iniciales idempotentes
│   └── demo/                    # datos de demostración (bloqueados en producción)
├── src/
│   ├── config/env.ts            # validación de variables de entorno
│   ├── shared/                  # filtro de errores, Prisma, seguridad, teléfono, tope por pedido, uploads
│   ├── cli/                     # reset-owner-password, run-order-deadlines
│   └── modules/                 # 16 módulos de dominio (ver A.4)
└── test/                        # 20 suites de integración (*.e2e-spec.ts) + utilidades
```

### A.3 Base de datos

- **Dinero:** `Decimal(12,2)` en COP; nunca punto flotante en la base. La API convierte a `number` al responder.
- **Fechas:** `timestamptz` en UTC; los reportes y el código de pedido usan `America/Bogota`.
- **Snapshots:** `Order` y `OrderItem` guardan nombre, SKU, precios, promoción y costo del momento.
- **Historiales append-only:** `InventoryMovement`, `VariantPriceHistory`, `PromotionRevision`, `OrderStatusHistory`, `PaymentRecord`.
- **Restricciones `CHECK` verificadas en migraciones** (última barrera; la aplicación debe validar antes):

| Restricción | Regla |
|---|---|
| `ProductVariant_stock_non_negative` | `stock >= 0` |
| `InventoryMovement_stock_after_consistent` | `stockAfter = stockBefore + quantity` |
| `InventoryMovement_quantity_non_zero` / `_stock_after_non_negative` | `quantity <> 0`, `stockAfter >= 0` |
| `Order_total_consistent` | `total = subtotal - discountTotal + COALESCE(shippingCost, 0)` |
| `OrderItem_line_total_consistent` | `lineTotal = unitFinalPrice * quantity` |
| `Order_cancel_reason_required` | pedido cancelado exige `cancelReason` |
| `Promotion_percentage_max` / `_dates_valid` / `_discount_value_positive` | `% <= 100`, `endsAt > startsAt`, `discountValue > 0` |
| `Testimonial_rating_range` | `rating BETWEEN 1 AND 5` |
| `Municipality_code_matches_department` | prefijo del código = departamento |
| `StoreSettings_single_row` | `id = 'default'` |

- **Claves únicas críticas:** `Order.code`, `Order.idempotencyKey`, `Order.publicTokenHash`, `ProductVariant.sku`, `Product.slug`, `Customer.phone`, `CancellationNotice(orderId, case, stage, deadlineAt)`.

### A.4 Servicios (módulos de dominio)

| Módulo | Servicio | Responsabilidad |
|---|---|---|
| `auth` | `AuthService`, `SessionService`, `AuthGuard` (global) | Inicio/cierre de sesión, bloqueo por intentos, sesiones revocables, guardia por rol |
| `admin-users` | `AdminUsersService` | Cuentas del personal (solo propietaria) |
| `store-settings` | `StoreSettingsService` | Configuración, contenido, páginas legales, tarifas por municipio, información pública |
| `payment-methods` | `PaymentMethodsService` | Activación, instrucciones, monto máximo y municipios del contra entrega |
| `locations` | (controlador directo) | Departamentos y municipios DIVIPOLA |
| `catalog/*` | `BrandsService`, `CategoriesService`, `ProductsService` | Marcas, categorías de 2 niveles, productos, variantes, fotos, catálogo público |
| `inventory` | `InventoryService` | Movimientos manuales y existencias |
| `promotions` | `PromotionsService`, `PricingService` | Promociones con versiones y motor único de precios "a una fecha" |
| `orders` | `OrdersService` | Cotización, checkout, gestión, pagos, envíos, seguimiento, cancelación automática |
| `shipping` | `ShippingService` | Transportadoras |
| `notices` | `NoticesService` | Ciclo de plazos, avisos de cancelación, notificaciones del panel |
| `reports` / `dashboard` | `ReportsService`, `DashboardService` | Reportes de ventas/márgenes (SQL crudo parametrizado) y pendientes del día |
| `testimonials` | `TestimonialsService` | Testimonios publicados por la propietaria |
| `health` | — | Salud con consulta a la base |

### A.5 API — inventario de endpoints verificados

Prefijo: `/api/v1`. "Sesión" = cualquier usuario del panel (`ADMIN` o `STAFF`). Toda ruta exige sesión salvo las marcadas `@Public()`.

| Dominio | Método y ruta | Acceso | Límite |
|---|---|---|---|
| Salud | `GET /health` | Público | Sin límite |
| Acceso | `POST /admin/auth/login` | Público | 10/min por IP |
| Acceso | `POST /admin/auth/logout` · `GET /admin/auth/me` · `PATCH /admin/auth/password` | Sesión | General |
| Cuentas | `GET, POST /admin/users` · `PATCH /admin/users/:id` · `POST /admin/users/:id/reset-password` | ADMIN | General |
| Marcas | `GET, POST /admin/brands` · `PATCH /admin/brands/:id` | Sesión | General |
| Marcas | `DELETE /admin/brands/:id` | ADMIN | General |
| Categorías | `GET, POST /admin/categories` · `PATCH /admin/categories/:id` | Sesión | General |
| Categorías | `DELETE /admin/categories/:id` | ADMIN | General |
| Productos | `GET /admin/products` · `GET /admin/products/:id` · `POST /admin/products` · `PATCH /admin/products/:id` · `PATCH /admin/products/:id/status` | Sesión | General |
| Productos | `DELETE /admin/products/:id` | ADMIN | General |
| Fotos | `POST /admin/products/:productId/images` (multipart, `file`) · `DELETE /admin/products/:productId/images/:imageId` | Sesión | General |
| Variantes | `POST /admin/products/:productId/variants` · `PATCH /admin/products/:productId/variants/:id` · `DELETE /admin/products/:productId/variants/:id` | Sesión | General |
| Inventario | `GET /admin/inventory/variants` · `GET /admin/inventory/movements` · `POST /admin/inventory/movements` | Sesión | General |
| Promociones | `GET /admin/promotions` · `GET /admin/promotions/:id` · `GET /admin/promotions/:id/revisions` · `POST /admin/promotions` · `PATCH /admin/promotions/:id` | ADMIN | General |
| Pedidos | `GET /admin/orders` · `GET /admin/orders/:id` | Sesión | General |
| Pedidos | `PATCH /admin/orders/:id/confirm` · `/shipping-cost` · `/status` · `/shipping` · `/items` · `/cancel` · `/payment-received` | Sesión (cancelar: STAFF con restricción) | General |
| Pagos | `PATCH /admin/orders/:id/payment/verify` · `/payment/reject` · `/payment/refund` | ADMIN | General |
| Transportadoras | `GET, POST /admin/carriers` · `PATCH /admin/carriers/:id` | Sesión | General |
| Métodos de pago | `GET /admin/payment-methods` | Sesión | General |
| Métodos de pago | `PATCH /admin/payment-methods/:id` · `PUT /admin/payment-methods/:id/cities` | ADMIN | General |
| Configuración | `GET /admin/settings` · `GET /admin/settings/shipping-rates` · `GET /admin/content` | Sesión | General |
| Configuración | `PATCH /admin/settings` · `POST /admin/settings/shipping-rates` · `DELETE /admin/settings/shipping-rates/:id` · `PATCH /admin/content` | ADMIN | General |
| Testimonios | `GET /admin/testimonials` | Sesión | General |
| Testimonios | `POST /admin/testimonials` · `PATCH /admin/testimonials/:id` · `DELETE /admin/testimonials/:id` | ADMIN | General |
| Avisos | `GET /admin/notices` · `GET /admin/notices/pending-count` · `PATCH /admin/notices/:id/sent` | Sesión | General |
| Notificaciones | `GET /admin/notifications` · `PATCH /admin/notifications/read-all` · `PATCH /admin/notifications/:id/read` | Sesión | General |
| Resumen | `GET /admin/dashboard/pending` | Sesión | General |
| Reportes | `GET /admin/reports/sales` · `/top-products` · `/margins` | ADMIN | General |
| Tienda | `GET /store/products` · `GET /store/products/:slug` · `GET /store/categories` · `GET /store/brands` | Público | General |
| Tienda | `GET /store/info` · `GET /store/content/:slug` · `GET /store/testimonials` | Público | General |
| Tienda | `GET /store/locations/departments` · `GET /store/locations/departments/:code/municipalities` | Público | General |
| Checkout | `POST /store/orders/quote` | Público | General |
| Checkout | `POST /store/orders` | Público | 10 cada 10 min por IP |
| Seguimiento | `POST /store/orders/lookup` | Público | 5/min por IP |
| Seguimiento | `GET /store/orders/tracking/:token` | Público | General |
| Archivos | `GET /uploads/*` (fuera del prefijo, estático) | Público | — |

Las peticiones con `x-internal-api-key` válida (servidor de Next.js) no cuentan para el límite por IP. Con `NODE_ENV=test` el limitador está desactivado.

### A.6 Autenticación y autorización

- **Guardia global** (`AuthGuard`): sin `@Public()`, exige cookie con JWT válido, sesión no revocada ni vencida y usuario activo. `@Roles(ADMIN)` agrega el control de rol (403).
- **Excepciones del personal** implementadas en el servicio, no en la guardia: cancelar solo por pago no demostrado vencido (`staffCanCancelRejected`), contra entrega pagado al entregar, costo de compra omitido en respuestas (`unitCost`, `costPrice`).
- **Bloqueo:** `LOGIN_MAX_FAILED_ATTEMPTS` intentos → `lockedUntil` por `LOGIN_LOCK_MINUTES`.
- **Recuperación:** sin correo; la propietaria restablece al personal; la propietaria usa `npm run owner:reset-password` en el servidor.
- **Clientes:** no tienen cuenta. Acceden a su pedido con un token HMAC de 48 hex (`TRACKING_TOKEN_SECRET`) o con código + teléfono.

### A.7 Integraciones externas

| Integración | Tipo | Verificación |
|---|---|---|
| WhatsApp | Solo enlaces `https://wa.me/<número>?text=<mensaje>` armados por el backend; **no hay API de WhatsApp** | Probar el contenido y la codificación del enlace; no hay nada que simular |
| Transportadoras | Plantilla de URL de rastreo con `{tracking}`; sin llamadas salientes | Probar el armado y la codificación |
| DIVIPOLA (DANE) | Datos cargados por migración (33 departamentos, 1.122 entradas) | Probar integridad de los datos de referencia |
| Correo, SMS, pasarela de pago, almacenamiento en la nube | **No existen** (decisión "Infraestructura sin servicios de pago") | No aplicable |

No hay webhooks ni llamadas HTTP salientes desde el backend: no aplican pruebas de webhooks ni de reintentos de terceros. La idempotencia sí aplica al checkout (`idempotencyKey`).

### A.8 Hallazgos del análisis estático que afectan este plan

Detalle, severidad y pregunta asociada en [`PLAN_MAESTRO_QA.md` §A.3](PLAN_MAESTRO_QA.md#a3-hallazgos-del-análisis-estático). Ninguno se corrigió: según `AGENTS.md` §5 se reportan para decisión.

| Hallazgo | Resumen | Casos |
|---|---|---|
| H-01 | La API pública expone `stock` exacto por variante. **Aceptado** (Q-01: no se cambia) | BE-039, BE-118 |
| H-02 | Se puede vender a precio final 0. **Q-02: no se permite**, hay que cambiar el código | BE-068, BE-073, BE-102, BE-106 a BE-108, BE-111, BE-143 |
| H-03 | Filtros de pedidos sin `@IsEnum` | BE-145 |
| H-04 | Borrar tarifa sin `ParseUUIDPipe` | BE-053 |
| H-05 | Cantidad de inventario sin máximo | BE-097 |
| H-06 | Carrera en existencias iniciales | BE-096 |
| H-07 | El bloqueo revela correos existentes | BE-019 |
| H-08 | Costo de envío editable tras el pago. **Aceptado** (Q-03: sí se permite) | BE-149 |
| H-09 | Monto verificado distinto del total / devolución parcial. Recomendación en §D.3, por confirmar | BE-170, BE-172 |
| H-10 | Cancelar un pedido pagado no registra devolución. **Q-05: debe exigirla**, hay que cambiar el código | BE-158 |
| H-11 | Renombrar producto cambia el slug | BE-069 |
| H-12 | Transiciones de producto sin restricción | BE-070, BE-071 |
| H-13 | Productos de categoría/marca inactiva visibles | BE-087 |
| H-14 | Búsqueda y ofertas en memoria; inventario sin paginar | BE-228, BE-230 |
| H-15 | Limitador apagado en pruebas; depende de `TRUST_PROXY_HOPS` | BE-011, BE-012 |
| H-17 | Token de seguimiento en logs de acceso | BE-225 |
| H-20 | Sin recomprobación de variante activa dentro de la transacción | BE-136 |

---

## B. Estrategia de pruebas

| Tipo | Objetivo en Sky Beauty | Herramienta | Dónde |
|---|---|---|---|
| **Unitarias** | Funciones puras: motor de precios (`priceWithPromotions`, `calculateDiscount`), `normalizeWhatsappNumber`, `effectiveMaxPerOrder`, `validateEnv`, textos de avisos (`notice-records.ts`), filtro de errores, `isInternalRequest`, armado del mensaje de WhatsApp | Jest + ts-jest | `src/**/*.spec.ts` |
| **Integración** | Servicio + Prisma + base real `sky_beauty_test`: reglas que dependen de transacciones y restricciones | Jest + `@nestjs/testing` | `test/*.e2e-spec.ts` |
| **API** | Contrato HTTP: códigos de estado, forma de error uniforme, validación, roles, campos expuestos | Supertest sobre `createTestApp()` (misma configuración que `main.ts`) | `test/*.e2e-spec.ts` |
| **Base de datos** | Migraciones desde cero, `CHECK` y claves únicas, datos DIVIPOLA, invariantes contables | Jest + SQL directo / `prisma migrate` | `test/db-*.e2e-spec.ts` (nuevo) |
| **Seguridad** | Riesgos OWASP aplicables (sección D.2): control de acceso, exposición de datos, inyección, asignación masiva, fuerza bruta | Supertest; revisión manual | `test/security-*.e2e-spec.ts` (nuevo) |
| **Rendimiento y carga** | Latencia del catálogo, búsqueda, cotización y checkout; ciclo de plazos con volumen | `autocannon` o k6 (ver Q-13) contra un entorno con datos ficticios | `perf/` (nuevo, fuera de CI por defecto) |
| **Concurrencia** | Reserva de la última unidad, idempotencia simultánea, bloqueo optimista de pedidos y promociones, ciclos de plazos simultáneos | `Promise.all` sobre Supertest | `test/*.e2e-spec.ts` |
| **Integridad y consistencia** | Historial de inventario cuadra con `stock`; totales cuadran; snapshots inmutables | Consultas de auditoría tras cada suite | `test/utils/invariants.ts` (nuevo) |
| **Manejo de errores** | Prisma P2002/P2003/P2025 → 409/404; errores no controlados → 500 sin detalles; entradas malformadas → 400 | Supertest + unitarias del filtro | — |
| **Regresión** | Toda la suite en cada cambio a `dev`; suite crítica P0 antes de desplegar | CI (ver F.7) | — |

**Principios:**

1. Reglas de negocio con pruebas de integración contra PostgreSQL real; no se simula Prisma en reglas de stock, totales ni concurrencia.
2. Cada suite empieza con `resetDatabase()` (conserva `Department`, `Municipality`, `_prisma_migrations`).
3. Tiempo controlado: los plazos se prueban con `runCycle(now)` y fechas inyectadas, nunca con esperas reales.
4. Datos evidentemente ficticios (`*.test`, teléfonos `57300000xxxx`, nombres "Prueba"). Nunca datos reales.

---

## C. Casos de prueba por dominio

**Leyenda de la columna Automatización:**

- `Sí · existe <archivo>`: ya hay una prueba automatizada que lo cubre (no ejecutada en esta auditoría; ver PLAN_MAESTRO_QA §A.1).
- `Parcial · existe <archivo>`: la prueba existente cubre una parte; ampliar.
- `Sí · nueva`: automatizable, por implementar.
- `No`: verificación manual o de revisión.

**Roles:** `ADMIN` = propietaria; `STAFF` = personal; `anónimo` = sin sesión. Todas las rutas llevan el prefijo `/api/v1`.

### C.1 Plataforma, configuración y manejo de errores

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-001 | Plataforma | El arranque rechaza variables inválidas | Unitaria | — | — | Llamar `validateEnv` con `JWT_SECRET` < 32, sin `TRACKING_TOKEN_SECRET`, sin `PUBLIC_SITE_URL`, sin plazos | Objetos de entorno | Lanza error que nombra cada variable inválida | P1 | Sí · existe `src/config/env.spec.ts` | Pendiente |
| BE-002 | Plataforma | `INTERNAL_API_KEY` obligatoria solo en producción | Unitaria | — | — | `validateEnv` con `NODE_ENV=production` sin clave; luego con `development` | — | Producción: error; desarrollo: válido | P1 | Sí · existe `src/config/env.spec.ts` | Pendiente |
| BE-003 | Plataforma | Salud con base disponible | API | `GET /health` (anónimo) | App iniciada | Enviar petición | — | 200 `{status:'ok', database:'ok'}` | P2 | Sí · existe `test/health.e2e-spec.ts` | Pendiente |
| BE-004 | Plataforma | Ruta inexistente con error uniforme | API | `GET /api/v1/no-existe` | — | Enviar petición | — | 404 con `statusCode, error, message, path, timestamp` | P2 | Sí · existe `test/health.e2e-spec.ts` | Pendiente |
| BE-005 | Plataforma | Cabeceras de seguridad de helmet | API | Cualquiera | — | Inspeccionar cabeceras | — | `X-Content-Type-Options`, `X-Frame-Options`, etc.; sin `X-Powered-By` | P2 | Sí · existe `test/health.e2e-spec.ts` | Pendiente |
| BE-006 | Plataforma | Swagger deshabilitado en producción | API | `GET /api/v1/docs` | App con `NODE_ENV=production` y entorno válido | Enviar petición | — | 404; en `development` responde 200 | P1 | Sí · nueva | Pendiente |
| BE-007 | Plataforma | CORS solo para orígenes configurados | API | `OPTIONS /store/products` | `CORS_ORIGINS=http://localhost:3000` | Preflight con `Origin` permitido y con `Origin: https://atacante.test` | — | Permitido: `Access-Control-Allow-Origin` igual al origen y `Allow-Credentials: true`; otro origen: sin cabecera de permiso | P1 | Sí · nueva | Pendiente |
| BE-008 | Plataforma | Campos no declarados se rechazan (anti asignación masiva) | API | `POST /store/orders/quote` (anónimo) | Variante activa | Enviar ítem con campo extra `unitPrice: 1` | `{items:[{variantId, quantity:1, unitPrice:1}]}` | 400 `property unitPrice should not exist`; ningún precio del cliente se usa | P0 | Sí · nueva | Pendiente |
| BE-009 | Plataforma | Mapeo de errores de Prisma y errores no controlados | Unitaria | — | — | Pasar a `AllExceptionsFilter` P2002, P2003, P2025, `PayloadTooLargeException`, `Error('x')` | — | 409, 409, 404, 413 con mensaje en español, 500 "Error interno del servidor." sin pila ni texto original | P1 | Sí · nueva | Pendiente |
| BE-010 | Plataforma | Los logs no contienen secretos | Unitaria | — | Logger con destino en memoria | Enviar petición con `Cookie`, `Authorization`, `x-internal-api-key` | — | Valores reemplazados por `[Redacted]` | P2 | Sí · nueva | Pendiente |
| BE-011 | Plataforma | Límite general de 120 peticiones/min por IP | API | `GET /store/info` | App con `NODE_ENV=development` (el limitador está apagado en `test`, ver H-15) | 121 peticiones en < 60 s desde la misma IP | — | Peticiones 1–120: 200; 121: 429 | P2 | Sí · nueva | Pendiente |
| BE-012 | Plataforma | La IP real se toma según `TRUST_PROXY_HOPS` | API | `POST /store/orders/lookup` | `TRUST_PROXY_HOPS=1`, limitador activo | 6 intentos con `X-Forwarded-For` distintos; repetir con la misma IP | Código/teléfono ficticios | IP distinta: no se bloquea; misma IP: 429 en el 6.º. Con `TRUST_PROXY_HOPS=0` todas comparten límite | P1 | Sí · nueva | Pendiente |
| BE-013 | Plataforma | Reconocimiento de la clave interna de Next.js | Unitaria | — | — | `isInternalRequest` con clave correcta, incorrecta, de otra longitud, ausente, y sin clave configurada | — | Solo `true` con la clave exacta configurada; nunca `true` sin clave configurada | P1 | Parcial · existe `test/lookup-throttle.e2e-spec.ts` | Pendiente |

### C.2 Autenticación y sesiones del panel

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-014 | Acceso | Inicio de sesión correcto con cookie segura | API | `POST /admin/auth/login` (anónimo) | Cuenta ADMIN activa | Enviar credenciales | `{email, password}` | 200 con perfil sin hash; `Set-Cookie sb_admin_session` con `HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` solo con `NODE_ENV=production`; BD: `AdminSession` creada, `lastLoginAt` actualizado | P0 | Parcial · existe `test/auth.e2e-spec.ts` (falta `Secure` en producción) | Pendiente |
| BE-015 | Acceso | Mismo error para correo inexistente y contraseña errada | API | `POST /admin/auth/login` | — | Probar ambos casos | — | 401 con "Correo o contraseña incorrectos." en los dos | P0 | Sí · existe `test/auth.e2e-spec.ts` | Pendiente |
| BE-016 | Acceso | Tiempo de respuesta similar con correo inexistente | Seguridad | `POST /admin/auth/login` | — | Medir 20 intentos de cada caso | — | Diferencia de medianas < 30 % (se usa hash de referencia) | P2 | Parcial · nueva (medición no determinista; no bloquear CI) | Pendiente |
| BE-017 | Acceso | Cuenta desactivada con error genérico | API | `POST /admin/auth/login` | Cuenta `isActive=false` | Credenciales correctas | — | 401 genérico; no se crea sesión | P0 | Sí · existe `test/auth.e2e-spec.ts` | Pendiente |
| BE-018 | Acceso | Bloqueo tras intentos fallidos | API | `POST /admin/auth/login` | `LOGIN_MAX_FAILED_ATTEMPTS=5` | 5 contraseñas erradas y luego la correcta | — | 6.º intento: 429 con minutos restantes; BD: `lockedUntil` futuro | P0 | Sí · existe `test/auth.e2e-spec.ts` | Pendiente |
| BE-019 | Acceso | Caracterización: el bloqueo revela si el correo existe (H-07) | Seguridad | `POST /admin/auth/login` | — | 6 intentos a correo existente y a correo inexistente | — | Documentar: existente → 429 "Cuenta bloqueada"; inexistente → siempre 401. Resultado final según Q-10 | P1 | Sí · nueva (caracterización) | Pendiente |
| BE-020 | Acceso | El bloqueo vence y un acceso correcto reinicia el contador | Integración | `POST /admin/auth/login` | Cuenta bloqueada | Mover `lockedUntil` al pasado; iniciar sesión | — | 200; BD: `failedLoginAttempts=0`, `lockedUntil=null` | P1 | Sí · nueva | Pendiente |
| BE-021 | Acceso | Límite de 10 inicios de sesión por minuto por IP | API | `POST /admin/auth/login` | Limitador activo (`NODE_ENV≠test`) | 11 intentos en < 60 s | Correos distintos | 11.º: 429 del limitador | P1 | Sí · nueva | Pendiente |
| BE-022 | Acceso | Validación del formato de entrada | API | `POST /admin/auth/login` | — | Correo inválido; contraseña vacía; contraseña de 201 caracteres; campos extra | — | 400 con mensajes en español | P2 | Sí · existe `test/auth.e2e-spec.ts` | Pendiente |
| BE-023 | Acceso | Rutas del panel protegidas por defecto | API | `GET /admin/orders` (anónimo) | — | Sin cookie | — | 401 "Debes iniciar sesión." | P0 | Sí · existe `test/auth.e2e-spec.ts` | Pendiente |
| BE-024 | Acceso | Token manipulado, firmado con otro secreto o vencido | Seguridad | `GET /admin/auth/me` | — | Cookie con firma alterada; con JWT firmado con otra clave; con `exp` pasado | — | 401 en los tres casos | P0 | Sí · nueva | Pendiente |
| BE-025 | Acceso | Cerrar sesión invalida la cookie anterior | API | `POST /admin/auth/logout` → `GET /admin/auth/me` | Sesión iniciada | Cerrar sesión y reutilizar la cookie | — | 204; luego 401; BD: `revokedAt` fijado | P0 | Sí · existe `test/auth.e2e-spec.ts` | Pendiente |
| BE-026 | Acceso | Sesión vencida por `expiresAt` | Integración | `GET /admin/auth/me` | Sesión creada | Mover `expiresAt` al pasado | — | 401 | P0 | Sí · nueva | Pendiente |
| BE-027 | Acceso | Sesión de cuenta desactivada después de iniciar | API | `GET /admin/auth/me` | Sesión de STAFF | Desactivar la cuenta en BD | — | 401 | P0 | Sí · existe `test/auth.e2e-spec.ts` | Pendiente |
| BE-028 | Acceso | Cambio de contraseña propia | API | `PATCH /admin/auth/password` (sesión) | Dos sesiones del mismo usuario | Cambiar con contraseña actual errada; con nueva < 12; correcto | — | 400, 400, 204; la otra sesión queda revocada y la actual sigue | P1 | Sí · existe `test/auth.e2e-spec.ts` | Pendiente |
| BE-029 | Acceso | Limpieza de sesiones de más de 30 días | Integración | — | Sesiones vencidas/revocadas hace 31 días y recientes | `purgeExpired(now)` | — | Solo se borran las de más de 30 días | P3 | Sí · existe `test/auth.e2e-spec.ts` | Pendiente |
| BE-030 | Acceso | Recuperación de la propietaria por comando | Integración | CLI `owner:reset-password` | Propietaria bloqueada con sesiones | Ejecutar con contraseña nueva; con cuenta STAFF; con contraseña corta | — | Restablece, desbloquea y cierra sesiones; rechaza STAFF y contraseñas cortas | P1 | Sí · existe `test/admin-users.e2e-spec.ts` | Pendiente |
| BE-031 | Acceso | El correo se normaliza al iniciar sesión | API | `POST /admin/auth/login` | Cuenta `duena@ejemplo.test` | Enviar `"  DUENA@Ejemplo.TEST "` | — | 200 | P2 | Sí · nueva | Pendiente |

### C.3 Autorización: matriz de roles

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-032 | Permisos | Ninguna ruta `/admin/*` responde sin sesión (salvo login) | Seguridad | Todas las de A.5 con prefijo `/admin` | — | Recorrer la tabla A.5 de forma parametrizada sin cookie | IDs UUID ficticios | 401 en todas; ninguna 2xx ni 500 | P0 | Sí · nueva (prueba guiada por datos) | Pendiente |
| BE-033 | Permisos | STAFF recibe 403 en rutas exclusivas de la propietaria | Seguridad | `/admin/users*`, `/admin/promotions*`, `/admin/reports*`, `PATCH /admin/settings`, `POST/DELETE /admin/settings/shipping-rates`, `PATCH /admin/content`, `PATCH/PUT /admin/payment-methods/*`, `POST/PATCH/DELETE /admin/testimonials*`, `DELETE` de marcas/categorías/productos, `/payment/verify`, `/payment/reject`, `/payment/refund` | Sesión STAFF; recursos existentes | Llamar cada ruta | Payload válido | 403 "No tienes permiso…" en todas; BD sin cambios | P0 | Parcial · existe en varias suites; consolidar en `test/permissions.e2e-spec.ts` | Pendiente |
| BE-034 | Permisos | STAFF puede lo que la decisión le permite | API | Confirmar, cotizar envío, cambiar estado, envío, editar pedido sin confirmar, registrar comprobante, inventario, crear/editar productos y variantes, borrar variantes y fotos, transportadoras, avisos, notificaciones, lectura de configuración y contenido | Sesión STAFF | Llamar cada ruta | Payload válido | 2xx en todas | P0 | Parcial · existe en varias suites; consolidar | Pendiente |
| BE-035 | Permisos | STAFF nunca recibe el costo de compra | Seguridad | `GET/POST/PATCH` de productos y variantes; `GET /admin/orders/:id` y todas las acciones de pedido | Variantes con `costPrice`; pedidos con `unitCost` | Inspeccionar cada respuesta | — | Sin `costPrice` en variantes; `unitCost=null` en ítems | P0 | Sí · existe `test/orders-admin.e2e-spec.ts`, `test/catalog.e2e-spec.ts` | Pendiente |
| BE-036 | Permisos | STAFF no puede fijar el costo de compra | API | `POST/PATCH /admin/products/:productId/variants*` (STAFF) | Producto existente | Enviar `costPrice: 1000` | — | Respuesta 2xx; BD: `costPrice` sin cambio (o `null` al crear) | P0 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-037 | Permisos | STAFF cancela solo por pago no demostrado vencido | API | `PATCH /admin/orders/:id/cancel` (STAFF) | Pedidos: sin confirmar; pago rechazado < 8 h; pago rechazado ≥ 8 h | Cancelar cada uno | `{reason:'Motivo de prueba'}` | 403, 403, 200 | P0 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-038 | Permisos | Las rutas públicas no exponen datos internos | Seguridad | Todas las `/store/*` | Datos completos (costos, notas, clientes) | Validar cada respuesta contra una lista blanca de campos | — | Nunca aparecen `costPrice`, `unitCost`, `carrierCost`, `notes`, `customerName`, `customerPhone`, `addressLine`, `deliveryNotes`, `isDemo`, `idempotencyKey`, `requestHash` | P0 | Sí · nueva | Pendiente |
| BE-039 | Permisos | Contrato de existencias en la API pública | API | `GET /store/products`, `GET /store/products/:slug` | Variante con `stock=7` | Inspeccionar `variants[]` | — | La API envía `stock` numérico (aceptado el 2026-10-15, Q-01: la API puede enviarlo). La restricción de no mostrar la cantidad aplica solo a la interfaz (FE-034) | P1 | Sí · nueva | Pendiente |

### C.4 Cuentas del personal

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-040 | Cuentas | No se puede crear una cuenta ADMIN desde la API | Seguridad | `POST /admin/users` (ADMIN) | — | Enviar `role:'ADMIN'` | `{email, name, password, role:'ADMIN'}` | 400 (campo no permitido); BD: sin cuenta nueva | P0 | Sí · nueva | Pendiente |
| BE-041 | Cuentas | Correos repetidos y contraseñas cortas | API | `POST /admin/users` (ADMIN) | Cuenta existente | Repetir correo; contraseña de 11 | — | 409 "Ya existe una cuenta con ese correo."; 400 | P1 | Sí · existe `test/admin-users.e2e-spec.ts` | Pendiente |
| BE-042 | Cuentas | Desactivar cierra sesiones | API | `PATCH /admin/users/:id` (ADMIN) | STAFF con sesión | `{isActive:false}` | — | 200; la sesión del STAFF responde 401 | P1 | Sí · existe `test/admin-users.e2e-spec.ts` | Pendiente |
| BE-043 | Cuentas | Restablecer contraseña quita bloqueo y cierra sesiones | API | `POST /admin/users/:id/reset-password` (ADMIN) | STAFF bloqueado con sesión | Restablecer | `{newPassword}` (≥ 12) | 204; BD: `lockedUntil=null`; sesiones revocadas | P1 | Sí · existe `test/admin-users.e2e-spec.ts` | Pendiente |
| BE-044 | Cuentas | La gestión del personal no toca cuentas ADMIN | Seguridad | `PATCH /admin/users/:id`, `/reset-password` | id de la propietaria | Llamar ambas | — | 404 "No existe una cuenta del personal…" | P0 | Sí · existe `test/admin-users.e2e-spec.ts` | Pendiente |
| BE-045 | Cuentas | El listado no expone datos sensibles | Seguridad | `GET /admin/users` (ADMIN) | Cuentas existentes | Inspeccionar | — | Sin `passwordHash` ni `failedLoginAttempts` | P0 | Sí · existe `test/admin-users.e2e-spec.ts` | Pendiente |
| BE-046 | Cuentas | Identificador malformado | API | `PATCH /admin/users/abc` (ADMIN) | — | Enviar | — | 400 por `ParseUUIDPipe` | P3 | Sí · nueva | Pendiente |

### C.5 Configuración, contenido y tarifas de envío

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-047 | Configuración | El personal lee pero no modifica | API | `GET/PATCH /admin/settings` (STAFF) | — | Leer y modificar | — | 200; 403 | P1 | Sí · existe `test/store-config.e2e-spec.ts` | Pendiente |
| BE-048 | Configuración | WhatsApp normalizado con código de país | API | `PATCH /admin/settings` (ADMIN) | — | Enviar `3001234567`, `+57 300 123 4567`, `573001234567`, `1234` | — | Los tres primeros guardan `573001234567`; `1234` → 400 | P1 | Sí · existe `test/store-config.e2e-spec.ts` | Pendiente |
| BE-049 | Configuración | Bajar el límite de descuento con promociones que lo superan | API | `PATCH /admin/settings` (ADMIN) | Promoción activa 40 %; otra vencida 60 %; otra inactiva 70 % | Fijar límite 30; luego 50 con solo la de 40 desactivada; luego `null` | — | 400 nombrando solo la de 40 %; 200; 200 (quitar el límite siempre se permite). El sistema no altera promociones | P0 | Sí · existe `test/promotions.e2e-spec.ts` | Pendiente |
| BE-050 | Configuración | Límites de las cifras comerciales | API | `PATCH /admin/settings` (ADMIN) | — | `maxUnitsPerProduct` 0 y 1000; `maxPercentageDiscount` 0 y 100,01; `freeShippingThreshold` −1; `defaultLowStockThreshold` 1,5 | — | 400 en todos; 1, 999, 0,01, 100 → 200 | P1 | Parcial · existe `test/store-config.e2e-spec.ts` | Pendiente |
| BE-051 | Configuración | Información pública solo con datos públicos | API | `GET /store/info` (anónimo) | Configuración completa | Inspeccionar | — | Solo campos de `PublicStoreInfoDto`; `publishedPages` lista solo páginas con texto | P1 | Sí · existe `test/store-config.e2e-spec.ts`, `test/content.e2e-spec.ts` | Pendiente |
| BE-052 | Tarifas | Crear o actualizar tarifa por municipio | API | `POST /admin/settings/shipping-rates` (ADMIN) | — | Crear para `05001`; repetir con otro monto; municipio `99999` | `{municipalityCode, amount}` | 2xx; la segunda actualiza (una fila); `99999` → 400 | P1 | Parcial · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-053 | Tarifas | Borrar tarifa: inexistente e identificador malformado (H-04) | API | `DELETE /admin/settings/shipping-rates/:id` (ADMIN) | — | UUID inexistente; `abc` | — | 404; para `abc` se espera 400/404, nunca 500 | P2 | Sí · nueva | Pendiente |
| BE-054 | Tarifas | Riohacha queda con 5.000 COP tras migrar | Base de datos | — | Base recién migrada | Consultar `MunicipalShippingRate` de `44001` | — | `amount = 5000.00` | P1 | Sí · nueva | Pendiente |
| BE-055 | Contenido | Páginas legales sin texto no existen | API | `GET /store/content/:slug` (anónimo) | `termsText` vacío; luego con texto | Consultar `terminos`, `__proto__`, `constructor`, `no-existe` | — | Sin texto: 404; con texto: 200 `{slug,title,text}`; nombres especiales: 404 | P1 | Sí · existe `test/content.e2e-spec.ts` | Pendiente |
| BE-056 | Contenido | El contenido se guarda como texto sin interpretar | Seguridad | `PATCH /admin/content` (ADMIN) → `GET /store/content/terminos` | — | Guardar `<script>alert(1)</script>` | — | Se devuelve literal; la tienda lo muestra como texto (ver FE-082) | P1 | Sí · nueva | Pendiente |

### C.6 Métodos de pago y ubicaciones

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-057 | Pagos config | Transferencia, Nequi y Daviplata exigen instrucciones | API | `PATCH /admin/payment-methods/:id` (ADMIN) | Métodos sembrados inactivos | Activar sin instrucciones; activar con instrucciones; borrar instrucciones estando activo | — | 400; 200; 400 | P0 | Parcial · existe `test/store-config.e2e-spec.ts` (falta borrar estando activo) | Pendiente |
| BE-058 | Pagos config | Contra entrega sin instrucciones y con monto máximo | API | `PATCH /admin/payment-methods/:id` (ADMIN) | — | Activar COD sin instrucciones; fijar `maxOrderTotal`; fijar `maxOrderTotal` en Nequi | — | 200; 200; Nequi → 400 "no admite un total máximo" | P1 | Sí · existe `test/store-config.e2e-spec.ts` | Pendiente |
| BE-059 | Pagos config | Municipios del contra entrega desde DIVIPOLA | API | `PUT /admin/payment-methods/:id/cities` (ADMIN) | — | Lista válida; lista con `99999`; en método no restringido | `{municipalityCodes:[...]}` | 200 reemplaza la lista; 400; 400 | P1 | Sí · existe `test/store-config.e2e-spec.ts` | Pendiente |
| BE-060 | Pagos config | Lista vacía: el contra entrega no se ofrece | Integración | `PUT …/cities` → `POST /store/orders/quote` | COD activo | Vaciar la lista y cotizar para `44001` | — | COD no aparece en `availablePaymentMethods` | P1 | Sí · nueva | Pendiente |
| BE-061 | Ubicaciones | Departamentos y municipios oficiales | API | `GET /store/locations/departments`, `…/:code/municipalities` (anónimo) | Migraciones aplicadas | Listar; pedir `44`; pedir `00` | — | 33 departamentos ordenados; municipios del `44` incluyen `44001` "Riohacha"; `00` → 404 | P2 | Parcial · existe `test/store-config.e2e-spec.ts` | Pendiente |
| BE-062 | Ubicaciones | Formato de nombres y totales DIVIPOLA | Base de datos | — | Base migrada | Contar `Municipality`; revisar ejemplos de la decisión | — | 1.122 filas; "San José del Guaviare", "Valle del Cauca", "Bogotá, D.C." con el formato decidido | P2 | Sí · nueva | Pendiente |

### C.7 Catálogo: marcas, categorías, productos, variantes y fotos

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-063 | Catálogo | Producto nuevo en borrador no se publica | API | `POST /admin/products` → `GET /store/products/:slug` | Marca y categoría | Crear y consultar en la tienda; luego `PATCH …/status {ACTIVE}` | Producto ficticio | Creado `DRAFT`; tienda 404; tras activar 200 y `publishedAt` fijado una sola vez | P0 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-064 | Catálogo | Solo `ACTIVE` es visible en listado y detalle | API | `GET /store/products`, `GET /store/products/:slug` | Productos `DRAFT`, `INACTIVE`, `ARCHIVED`, `ACTIVE` | Listar y pedir cada slug | — | Solo el `ACTIVE`; los demás 404 | P0 | Parcial · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-065 | Catálogo | Reglas entre categorías | API | `POST/PATCH /admin/categories`, `POST /admin/products` | Categoría con subcategoría | Crear tercer nivel; producto en categoría con hijos; categoría padre de sí misma | — | 400 en los tres | P1 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-066 | Catálogo | Borrado de categorías y marcas en uso | API | `DELETE /admin/categories/:id`, `DELETE /admin/brands/:id` (ADMIN) | Con hijos o productos | Borrar | — | 409 con mensaje; sin uso: 204 | P1 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-067 | Catálogo | Unicidad de marca y slug | API | `POST /admin/brands`, `POST /admin/products` | Marca y producto existentes | Repetir nombre/slug | — | 409 | P2 | Sí · nueva | Pendiente |
| BE-068 | Catálogo | Campos obligatorios y precio base positivo | API | `POST/PATCH /admin/products` | — | Sin marca; sin categoría; `basePrice` −1 y 0; descripción vacía; nombre de 201 | — | 400 en todos. `basePrice` 0 se rechaza porque no se permite precio final 0 (Q-02, 2026-10-15) | P1 | Parcial · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-069 | Catálogo | Caracterización: renombrar cambia el slug (H-11) | Integración | `PATCH /admin/products/:id` | Producto `ACTIVE` | Cambiar `name` sin enviar `slug`; consultar el slug anterior | — | Documentar: slug nuevo; el anterior responde 404. Resultado final según Q-07 | P2 | Sí · nueva (caracterización) | Pendiente |
| BE-070 | Catálogo | Caracterización: transiciones de estado del producto (H-12) | Integración | `PATCH /admin/products/:id/status` | Producto `ARCHIVED` | Pasar a `ACTIVE` | — | Documentar: hoy se permite; `archivedAt` se conserva. Resultado final según Q-08 | P2 | Sí · nueva (caracterización) | Pendiente |
| BE-071 | Catálogo | Caracterización: producto activo sin variantes activas (H-12) | Integración | `GET /store/products/:slug` | Producto `ACTIVE` sin variantes | Consultar | — | Documentar: responde con `variants:[]` y precio base; no es comprable. Resultado final según Q-18 | P2 | Sí · nueva (caracterización) | Pendiente |
| BE-072 | Catálogo | Borrar producto con historial pide archivar | API | `DELETE /admin/products/:id` (ADMIN) | Producto con pedido; otro con movimientos; otro limpio | Borrar los tres | — | 409, 409, 204 (borra variantes y carpeta de fotos) | P1 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-073 | Variantes | Validación y unicidad de variantes | API | `POST/PATCH /admin/products/:productId/variants*` | Producto existente | SKU repetido; `colorHex` `#GGG000`; `price` −1 y 0; `maxPerOrder` 0 | — | 409; 400; 400 (precio propio 0 no permitido, Q-02); 400 | P1 | Parcial · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-074 | Variantes | Borrar variante con historial | API | `DELETE /admin/products/:productId/variants/:id` | Variante con pedido; otra con movimiento; otra limpia; variante de otro producto | Borrar | — | 409, 409, 204, 404 | P1 | Sí · nueva | Pendiente |
| BE-075 | Precios | Historial del precio efectivo | Integración | Variantes y `PATCH /admin/products/:id` | Producto con variante sin precio propio y otra con precio | Crear; cambiar `basePrice`; cambiar `price` de una; quitar `price` | — | Una fila de `VariantPriceHistory` por cada cambio del precio efectivo; ninguna si no cambia | P0 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-076 | Fotos | Foto demasiado grande se corta al recibirla | API | `POST /admin/products/:productId/images` | `MAX_IMAGE_SIZE_MB=5` | Subir 6 MB | — | 413 "El archivo supera el tamaño máximo permitido." | P1 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-077 | Fotos | Archivo que no es imagen con tipo declarado de imagen | Seguridad | `POST /admin/products/:productId/images` | — | Subir texto con `Content-Type: image/png`; subir GIF | — | 400 "no parece ser una imagen válida"; GIF → 400 "Solo se aceptan…" | P1 | Sí · nueva | Pendiente |
| BE-078 | Fotos | Foto de variante de otro producto | API | `POST /admin/products/:productId/images` | Variante de producto B | Subir a producto A con `variantId` de B | — | 404; no se escribe en disco | P1 | Sí · nueva | Pendiente |
| BE-079 | Fotos | Procesamiento y publicación de la foto | Integración | `POST …/images` → `GET /uploads/<storageKey>` | — | Subir JPG 3000×2000 | — | WebP ≤ 1600 px y miniatura 420×420 en `UPLOADS_DIR/products/<id>`; URL pública 200 | P2 | Parcial · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-080 | Fotos | Quitar foto borra registro y archivos | API | `DELETE /admin/products/:productId/images/:imageId` (STAFF) | Foto existente | Borrar | — | 204; archivos eliminados; foto de otro producto → 404 | P2 | Sí · nueva | Pendiente |
| BE-081 | Fotos | Imagen con dimensiones extremas (bomba de descompresión) | Seguridad | `POST …/images` | — | PNG pequeño de 20.000×20.000 px | — | 400 o rechazo controlado; el proceso no se cae | P2 | Sí · nueva | Pendiente |
| BE-082 | Tienda | Filtros por categoría, marca y búsqueda | API | `GET /store/products?categoryId&brandId&q` | Productos en categoría y subcategoría; nombres con tildes | Filtrar por categoría padre; por marca; `q=sombra` vs "Sómbra" | — | La categoría padre incluye subcategorías; búsqueda sin tildes ni mayúsculas | P1 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-083 | Tienda | Paginación y límites | API | `GET /store/products` | 25 productos activos | `limit=20&page=2`; `limit=101`; `page=0`; `limit=abc` | — | 5 ítems y `total=25`; 400; 400; 400 | P1 | Sí · nueva | Pendiente |
| BE-084 | Tienda | Consulta por ids (favoritos) | API | `GET /store/products?ids=` | Productos activos e inactivos | 3 ids válidos con uno inactivo; 101 ids; id no UUID | — | Solo activos; 400; 400 | P1 | Parcial · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-085 | Tienda | Solo ofertas, ordenadas por descuento y combinables | API | `GET /store/products?onSale=true&categoryId=` | Promociones de 10 %, 30 %, fijo | Consultar con y sin categoría | — | Solo con descuento vigente, de mayor a menor proporción; respeta la categoría | P1 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-086 | Tienda | Destacados | API | `GET /store/products?featured=true` | Productos con y sin `isFeatured` | Consultar | — | Solo destacados activos | P2 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |
| BE-087 | Tienda | Caracterización: categoría o marca inactiva (H-13) | Integración | `GET /store/products`, `GET /store/categories`, `GET /store/brands` | Producto activo en categoría inactiva | Consultar | — | Documentar: el árbol y las marcas lo ocultan, el listado y el detalle lo muestran. Resultado final según Q-09 | P2 | Sí · nueva (caracterización) | Pendiente |
| BE-088 | Tienda | Búsqueda con texto extremo | API | `GET /store/products?q=` | — | `q` de 10.000 caracteres; `q=%27%20OR%201=1--` | — | 200 sin resultados o 400 controlado; nunca 500 | P3 | Sí · nueva | Pendiente |
| BE-089 | Tienda | Árbol público y marcas | API | `GET /store/categories`, `GET /store/brands` | Categorías activas/inactivas con y sin productos activos | Consultar | — | Solo categorías activas con productos activos (directos o en subcategorías); marcas activas con productos activos | P2 | Sí · nueva | Pendiente |
| BE-090 | Catálogo | Personal: crea y edita, no elimina | API | Productos, marcas, categorías (STAFF) | — | Crear, editar, eliminar | — | 2xx en crear/editar; 403 en eliminar producto, marca y categoría | P0 | Sí · existe `test/catalog.e2e-spec.ts` | Pendiente |

### C.8 Inventario

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-091 | Inventario | Existencias iniciales solo una vez y antes de todo | API | `POST /admin/inventory/movements` | Variante sin movimientos | `INITIAL 10`; repetir `INITIAL 5` | `{variantId, type, quantity}` | 201 `stock=10`; 409 | P0 | Sí · existe `test/inventory.e2e-spec.ts` | Pendiente |
| BE-092 | Inventario | Compras positivas; ajustes con justificación | API | `POST /admin/inventory/movements` | Variante con stock 10 | `PURCHASE 0`; `PURCHASE -1`; `ADJUSTMENT -2` sin motivo; con motivo | — | 400; 400; 400; 201 `stock=8` | P0 | Sí · existe `test/inventory.e2e-spec.ts` | Pendiente |
| BE-093 | Inventario | Nunca existencias negativas | API | `POST /admin/inventory/movements` | Stock 3 | `ADJUSTMENT -4` | Con motivo | 400 "no puede dejar existencias negativas"; BD sin cambios | P0 | Sí · existe `test/inventory.e2e-spec.ts` | Pendiente |
| BE-094 | Inventario | Los movimientos de pedidos no se registran a mano | API | `POST /admin/inventory/movements` | — | `ORDER_RESERVED`, `ORDER_RELEASED`, `RETURN` | — | 400 | P0 | Sí · existe `test/inventory.e2e-spec.ts` | Pendiente |
| BE-095 | Inventario | Movimientos simultáneos no se pisan | Concurrencia | `POST /admin/inventory/movements` ×N | Stock 5 | 10 ajustes `-1` simultáneos | — | Exactamente 5 se aplican; `stock=0`; historial encadenado | P0 | Sí · existe `test/inventory.e2e-spec.ts` | Pendiente |
| BE-096 | Inventario | Dos existencias iniciales simultáneas (H-06) | Concurrencia | `POST /admin/inventory/movements` ×2 | Variante sin movimientos | Dos `INITIAL` en paralelo | — | Esperado: una 201 y otra 409; un solo `INITIAL` en BD | P1 | Sí · nueva | Pendiente |
| BE-097 | Inventario | Cantidad fuera del rango de `Int` (H-05) | API | `POST /admin/inventory/movements` | — | `PURCHASE 3000000000` | — | 400, nunca 500 | P2 | Sí · nueva | Pendiente |
| BE-098 | Inventario | El historial cuadra con las existencias | Integridad | — | Tras cualquier suite de inventario o pedidos | Para cada variante: suma de `quantity` = `stock`; cada movimiento `stockBefore` = `stockAfter` del anterior | — | Sin diferencias | P0 | Sí · nueva (`test/utils/invariants.ts`) | Pendiente |
| BE-099 | Inventario | Alertas de stock bajo | API | `GET /admin/inventory/variants?lowStock=true` | Variantes con umbral 5 y stock 5, 6; sin umbral con stock 0 | Consultar | — | Solo la de stock 5; sin umbral no hay alerta | P1 | Sí · existe `test/inventory.e2e-spec.ts` | Pendiente |
| BE-100 | Inventario | Paginación del historial | API | `GET /admin/inventory/movements` | 40 movimientos | `limit=30&page=2`; `limit=101` | — | 10 ítems; 400 | P3 | Sí · nueva | Pendiente |

### C.9 Promociones y motor de precios

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-101 | Promociones | Solo la propietaria gestiona promociones | API | `/admin/promotions*` (STAFF) | — | Listar, crear, editar | — | 403 | P0 | Sí · existe `test/promotions.e2e-spec.ts` | Pendiente |
| BE-102 | Promociones | Límite porcentual configurado y tope técnico | API | `POST/PATCH /admin/promotions` (ADMIN) | Límite 30; luego sin límite | Crear 31 %; crear 99 % sin límite; crear 100 % sin límite | — | 400; 201; 400: un 100 % deja el precio final en 0, que no se permite (Q-02). Hoy se acepta y `test/promotions.e2e-spec.ts` ("sin límite configurado solo aplica el tope técnico del 100 %") lo da por válido: esa prueba debe actualizarse | P0 | Parcial · existe `test/promotions.e2e-spec.ts` (contradice Q-02) | Pendiente |
| BE-103 | Promociones | Fechas, destinos y alcance coherentes | API | `POST /admin/promotions` | — | Inicio ≥ fin; `scope=VARIANT` sin `variantIds`; ids inexistentes; valor 0 | — | 400 en todos | P1 | Sí · existe `test/promotions.e2e-spec.ts` | Pendiente |
| BE-104 | Promociones | Versiones y ediciones simultáneas | Concurrencia | `PATCH /admin/promotions/:id` ×2 | Promoción creada (versión 1) | Dos ediciones en paralelo | — | Una 200 (versión 2) y otra 409; sin versiones duplicadas | P1 | Sí · existe `test/promotions.e2e-spec.ts` | Pendiente |
| BE-105 | Precios | Reglas del motor de precios | Unitaria | `priceWithPromotions` | — | Casos de no acumulación, mayor descuento, empate por creación, alcance, subcategoría, vigencia inclusiva, desactivadas | Promociones en memoria | Según decisión del 2026-10-09 (actualizada) | P0 | Sí · existe `src/modules/promotions/pricing.service.spec.ts` | Pendiente |
| BE-106 | Precios | Un descuento fijo no puede dejar el precio en 0 | Integración | `POST/PATCH /admin/promotions` → `GET /store/products/:slug` → `POST /store/orders` | Variante de 20.000 | Crear una promoción fija de 25.000 y otra de 20.000 sobre ella; consultar la tienda; intentar comprar | — | Ningún precio final queda en 0 en la tienda, la cotización ni el pedido (Q-02, 2026-10-15). Mecanismo por confirmar (Q-22); recomendado: la promoción se rechaza con 400 al guardarla si deja algún destino en 0 o menos | P0 | Sí · nueva | Pendiente |
| BE-107 | Precios | Promoción del 100 % | API | `POST/PATCH /admin/promotions` | `maxPercentageDiscount=null` | Crear o editar a 100 % | — | 400: el precio final quedaría en 0 (Q-02) | P1 | Sí · nueva | Pendiente |
| BE-108 | Precios | Redondeo al peso sin descuadres ni precio 0 | Integración · Unitaria | `POST /store/orders/quote`, `POST /store/orders`, `calculateDiscount` | Variante de 9.999 con 33,33 %; variante de 1 COP con 50 % | Cotizar 3 unidades y crear; calcular el precio de la variante de 1 COP | — | `unitDiscount` redondeado al peso; `lineTotal = unitFinalPrice × cantidad`; `total = subtotal − descuento + envío`; sin decimales residuales. El redondeo nunca deja el precio final en 0 (hoy `Math.round(0,5)=1` lo haría con 1 COP al 50 %; Q-02) | P0 | Sí · nueva | Pendiente |
| BE-109 | Precios | Precio y promoción "a una fecha" | Integración | `PricingService.priceVariantsAt(ids, at)` | Historial de precio y versiones de promoción | Evaluar en fechas anteriores y posteriores a cada cambio | — | Usa la versión vigente en `at`; ignora las creadas después; respeta las desactivadas después | P0 | Sí · existe `test/promotions.e2e-spec.ts` | Pendiente |
| BE-110 | Precios | Limitación conocida: la categoría no tiene historial | Integración | `PATCH /admin/orders/:id/items` | Pedido de ayer; el producto cambió de categoría hoy | Agregar ese producto al pedido | — | Documentar que se evalúa con la categoría actual (limitación aceptada en `decisiones.md`) | P3 | Sí · nueva (caracterización) | Pendiente |
| BE-111 | Precios | Descuento fijo de categoría sobre productos de distinto precio | Unitaria | `calculateDiscount`, `priceWithPromotions` | Promoción fija 15.000 | Productos de 10.000 y 50.000 | — | 50.000 → descuento 15.000. 10.000 → nunca precio final 0 (Q-02); resultado exacto según el mecanismo de Q-22. Hoy `pricing.service.spec.ts` ("un descuento fijo mayor que el precio deja el precio final en 0") afirma lo contrario y debe actualizarse | P2 | Parcial · existe `src/modules/promotions/pricing.service.spec.ts` (contradice Q-02) | Pendiente |
| BE-112 | Precios | Vigencia en el límite del día en hora de Colombia | Integración | `GET /store/products/:slug` | Promoción que termina 2026-10-31 23:59:59 −05:00 | Evaluar a las 23:59:59 y a las 00:00:00 del día siguiente (hora de Colombia) | — | Aplica en el primer instante; no en el segundo | P1 | Sí · nueva | Pendiente |
| BE-113 | Promociones | Listado con filtros | API | `GET /admin/promotions?isActive&scope&q` | Promociones variadas | Filtrar | — | Resultados coherentes y `total` correcto | P3 | Parcial · existe `test/promotions.e2e-spec.ts` | Pendiente |

### C.10 Carrito, cotización y creación del pedido (checkout)

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-114 | Cotización | Precios, descuentos y total calculados en el servidor | API | `POST /store/orders/quote` (anónimo) | Variantes con y sin promoción | Cotizar | `{items:[{variantId, quantity}], municipalityCode}` | 200 con `unitListPrice`, `unitDiscount`, `unitFinalPrice`, `lineTotal`, `subtotal`, `discountTotal`, `total`; BD sin cambios | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-115 | Cotización | Artículos con problemas se marcan sin fallar | API | `POST /store/orders/quote` | Una variante sin stock suficiente, otra sobre el máximo, otra inactiva | Cotizar | — | 200; `issue` = `INSUFFICIENT_STOCK` / `OVER_MAX_PER_ORDER`; inactiva en `unavailableVariantIds`; `canCheckout=false` | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-116 | Cotización | Líneas repetidas de la misma variante se suman | API | `POST /store/orders/quote` | Stock 3 | Dos líneas de la misma variante con 2 y 2 | — | Una línea con cantidad 4 e `issue=INSUFFICIENT_STOCK` | P1 | Sí · nueva | Pendiente |
| BE-117 | Cotización | Máximo por variante y tope general | API | `POST /store/orders/quote` | `maxPerOrder=3`; `maxUnitsPerProduct=2` | Cotizar 3 | — | `maxPerOrder=2` (gana el menor) e `issue=OVER_MAX_PER_ORDER` | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-118 | Cotización | Máximo que se puede pedir | API | `POST /store/orders/quote` | Variante sin máximo con stock 7; otra con stock 7 y máximo 3 | Cotizar 1 de cada una | — | `maxQuantity` = 7 y 3 (menor entre existencias y máximo). Exponer las existencias en la API está aceptado (Q-01) | P2 | Sí · nueva | Pendiente |
| BE-119 | Cotización | Cantidades e ítems fuera de rango | API | `POST /store/orders/quote` | — | `quantity` 0, −1, 1,5, 1000, `"2"`; `items` vacío; 81 ítems; `variantId` no UUID; `municipalityCode` `"4400"` | — | 400 en todos | P0 | Sí · nueva | Pendiente |
| BE-120 | Envío | Prioridad del costo de envío | API | `POST /store/orders/quote` | Combinaciones de `nationalFreeShipping`, `freeShippingThreshold` y tarifa | Cotizar cada combinación | — | Nacional activo → 0; umbral alcanzado → 0; tarifa → monto; ninguna → `null` "Envío por confirmar" | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-121 | Envío | Umbral de envío gratis después de descuentos, en el borde | API | `POST /store/orders/quote` | Umbral 100.000; productos de 110.000 con 10 % | Cotizar (subtotal neto 99.000); luego neto exactamente 100.000 | — | 99.000 → no gratis; 100.000 → gratis (`>=`) | P0 | Sí · nueva | Pendiente |
| BE-122 | Envío | Tarifa local de Riohacha | API | `POST /store/orders/quote` | Base migrada sin envío gratis | Cotizar con `44001` | — | `shippingCost=5000` | P1 | Sí · nueva | Pendiente |
| BE-123 | Pago | Contra entrega por municipio y monto máximo | API | `POST /store/orders/quote` | COD activo en `44001`, máximo 200.000 | Cotizar en `44001` con total 200.000 y 200.001; en `05001` | — | Se ofrece con 200.000; no con 200.001; no en `05001`. El total comparado incluye el envío conocido | P0 | Parcial · existe `test/checkout.e2e-spec.ts` (falta el borde exacto) | Pendiente |
| BE-124 | Pedido | Creación con snapshots, reserva y enlace de seguimiento | API | `POST /store/orders` (anónimo) | Stock 5; método activo | Crear con 2 unidades | Payload completo ficticio | 201 con `code` `SB-AAMMDD-XXXXXX` (fecha de Bogotá), `trackingUrl`, `whatsappMessage`; BD: `Order` `PENDING_CONFIRMATION`/`PENDING`, ítems con snapshot y `unitCost`, `Customer` por teléfono, movimiento `ORDER_RESERVED`, `stock=3`, `termsAcceptedAt` y `dataProcessingConsentAt` | P0 | Parcial · existe `test/checkout.e2e-spec.ts` (falta el formato del código con fecha de Bogotá) | Pendiente |
| BE-125 | Pedido | Cambios posteriores del catálogo no alteran el pedido | Integración | `PATCH` de producto/variante → `GET /admin/orders/:id` | Pedido creado | Cambiar nombre, precio y SKU | — | El pedido conserva los valores del momento | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-126 | Pedido | Las dos casillas son obligatorias y separadas | API | `POST /store/orders` | — | `termsAccepted=false`; `dataProcessingAccepted=false`; ausentes | — | 400 en todos; BD sin pedido | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-127 | Pedido | Un pedido rechazado no deja efectos | Integración | `POST /store/orders` | Stock 1 | Pedir 2; pedir con método no disponible; con municipio `99999` | — | 400 en todos; sin `Order`, sin `Customer` nuevo, sin movimientos, stock intacto | P0 | Parcial · existe `test/checkout.e2e-spec.ts` (verificar ausencia de efectos) | Pendiente |
| BE-128 | Pedido | Dos clientes por la última unidad | Concurrencia | `POST /store/orders` ×2 | Stock 1 | Dos pedidos simultáneos con claves distintas | — | Uno 201 y otro 400; `stock=0`; un solo `ORDER_RESERVED` | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-129 | Pedido | Ráfaga de compradores contra stock limitado | Concurrencia | `POST /store/orders` ×20 | Stock 5; limitador apagado | 20 pedidos simultáneos de 1 unidad | — | Exactamente 5 pedidos; `stock=0`; nunca negativo; ningún 500 | P0 | Sí · nueva | Pendiente |
| BE-130 | Idempotencia | Reintento con la misma clave | API | `POST /store/orders` ×2 | — | Repetir la misma petición | Misma `idempotencyKey` | Mismo `id` y `code`; una sola reserva | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-131 | Idempotencia | Envíos simultáneos con la misma clave | Concurrencia | `POST /store/orders` ×5 | — | 5 en paralelo con la misma clave | — | Un solo pedido; todas las respuestas con el mismo `code` | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-132 | Idempotencia | La misma clave con otros datos | API | `POST /store/orders` | Pedido creado con clave K | Repetir K con otra dirección | — | 409 "La clave de idempotencia ya fue usada con otro pedido." | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-133 | Pedido | Teléfono normalizado y un solo cliente | API | `POST /store/orders` ×3 | — | Teléfonos `300 123 4567`, `+57 300-123-4567`, `573001234567`; luego `12345` | — | Un `Customer` con `573001234567`; `12345` → 400 | P1 | Parcial · existe `src/shared/phone.spec.ts` | Pendiente |
| BE-134 | Pedido | Longitudes de los datos del cliente | API | `POST /store/orders` | — | Nombre de 1 y 121; dirección de 4 y 221; indicaciones de 301; teléfono de 6 y 31 | — | 400 en todos | P1 | Sí · nueva | Pendiente |
| BE-135 | Pedido | Método de pago inactivo o inexistente | API | `POST /store/orders` | — | `paymentMethodId` inactivo; UUID inexistente | — | 400 "El método de pago no está disponible…" | P0 | Parcial · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-136 | Pedido | Variante desactivada entre la cotización y la reserva (H-20) | Concurrencia | `POST /store/orders` | — | Desactivar el producto en paralelo con la creación | — | Esperado: no se crea pedido con un producto no publicado; documentar la ventana actual | P1 | Sí · nueva | Pendiente |
| BE-137 | WhatsApp | Mensaje con pedido, productos, importes y entrega | API | `POST /store/orders` | WhatsApp configurado | Crear | — | `whatsappMessage` incluye código, líneas, subtotal, descuento, envío, total, datos de entrega, método y enlace; `whatsappUrl` = `https://wa.me/<número>?text=<codificado>` | P0 | Sí · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-138 | WhatsApp | Sin número configurado y con envío por confirmar | API | `POST /store/orders` | Sin `whatsappNumber`; municipio sin tarifa | Crear | — | `whatsappUrl=null`; el mensaje dice "Envío por confirmar" y "Total sin envío" | P1 | Parcial · existe `test/checkout.e2e-spec.ts` | Pendiente |
| BE-139 | Pedido | Límite de 10 pedidos cada 10 minutos por IP | API | `POST /store/orders` ×11 | Limitador activo | 11 pedidos | — | 11.º → 429 | P1 | Sí · existe `test/lookup-throttle.e2e-spec.ts` | Pendiente |
| BE-140 | Pedido | Caracteres especiales en los datos del cliente | Seguridad | `POST /store/orders` | — | Nombre `<img src=x onerror=alert(1)>` y emojis; indicaciones con saltos de línea | — | 201; se guarda literal; `whatsappUrl` codificado correctamente | P1 | Sí · nueva | Pendiente |
| BE-141 | Pedido | Precio enviado por el cliente se ignora | Seguridad | `POST /store/orders` | — | Agregar `total`, `subtotal` o `unitPrice` al cuerpo | — | 400 (campo no permitido) | P0 | Sí · nueva | Pendiente |
| BE-142 | Integridad | Totales del pedido cuadran | Integridad | — | Tras las suites de checkout y pedidos | Para cada pedido: `total = subtotal − discountTotal + COALESCE(shippingCost,0)`; `Σ lineTotal = subtotal − discountTotal` | — | Sin diferencias | P0 | Sí · nueva (`test/utils/invariants.ts`) | Pendiente |
| BE-143 | Integridad | Ningún pedido con artículos a precio 0 | Integridad | — | Tras las suites de checkout, pedidos y promociones | Consultar `OrderItem` con `unitFinalPrice <= 0` y pedidos con `subtotal − discountTotal <= 0` | — | Ninguno (Q-02) | P1 | Sí · nueva (`test/utils/invariants.ts`) | Pendiente |

### C.11 Gestión de pedidos

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-144 | Pedidos | Bandeja con filtros, búsqueda y paginación | API | `GET /admin/orders` (sesión) | 25 pedidos variados | Filtrar por `status`, `paymentStatus`, `q` (código, nombre, teléfono); `page=2&limit=20` | — | Resultados coherentes; `total` correcto; orden por fecha descendente | P1 | Parcial · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-145 | Pedidos | Filtro con valor inexistente (H-03) | API | `GET /admin/orders?status=FOO` | — | Enviar | — | 400; nunca 500 | P2 | Sí · nueva | Pendiente |
| BE-146 | Pedidos | Detalle completo según el rol | API | `GET /admin/orders/:id` | Pedido con eventos, pagos y envío | Consultar como ADMIN y STAFF | — | Incluye `trackingUrl`, eventos, pagos, envío, `paymentClarificationDeadline`, `staffCanCancel`; `unitCost` solo para ADMIN; id inexistente → 404 | P0 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-147 | Pedidos | Confirmar exige el costo del envío | API | `PATCH /admin/orders/:id/confirm` | Pedido con envío `null` | Confirmar sin costo; con `{shippingCost:8000}` | — | 400; 200 `CONFIRMED`, `confirmedAt`, `total` recalculado; evento registrado | P0 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-148 | Pedidos | Confirmar solo pendientes y una sola vez | Concurrencia | `PATCH /admin/orders/:id/confirm` ×2 | Pedido pendiente con envío | Dos confirmaciones simultáneas; confirmar un cancelado | — | Una 200 y otra 409/400; cancelado → 400 | P0 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-149 | Pedidos | Cotizar el envío después de confirmar o pagar | Integración | `PATCH /admin/orders/:id/shipping-cost` | Pedidos `CONFIRMED`, `PREPARING` y `SHIPPED` con pago `PAID`; otros `DELIVERED` y `CANCELLED` | Cambiar el costo | `{shippingCost:12000}` | Permitido (Q-03, 2026-10-15): 200 en los tres primeros, `total` recalculado y evento `SHIPPING` con autor; `DELIVERED`/`CANCELLED` → 400. Qué pasa con el pago si el total sube después de verificado queda en Q-21 | P1 | Sí · nueva | Pendiente |
| BE-150 | Pedidos | "Cambiar estado" solo marca en preparación | API | `PATCH /admin/orders/:id/status` | Pedido `CONFIRMED` | Pasar a `PREPARING`; intentar `SHIPPED`, `DELIVERED`, `CONFIRMED`, `CANCELLED`; desde `PENDING_CONFIRMATION` a `PREPARING` | — | 200; los demás 400 con el mensaje de la acción correcta | P1 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-151 | Edición | Editar un pedido sin confirmar | API | `PATCH /admin/orders/:id/items` (STAFF) | Pedido con 2 líneas; precio de una cambió; promoción vencida | Subir una cantidad, quitar otra línea, agregar variante nueva | — | Las que estaban conservan su precio; la agregada toma precio y promoción del día del pedido; existencias reservadas/liberadas con movimientos; total recalculado; evento `ITEMS_CHANGED` | P0 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-152 | Edición | Variantes no disponibles al editar | API | `PATCH /admin/orders/:id/items` | Variante agregada inactiva; línea cuya variante fue borrada (`variantId=null`) | Agregar la inactiva; editar el resto | — | 400 al agregar inactiva; la línea sin variante se conserva intacta | P1 | Sí · nueva | Pendiente |
| BE-153 | Edición | Envío recalculado al editar | API | `PATCH /admin/orders/:id/items` | Combinaciones de tarifa, umbral, nacional y cotización manual | Editar cantidades | — | Según decisión del 2026-10-13: regla del checkout; sin tarifa conserva la cotización manual; de gratis a no gratis sin tarifa → `null`; evento de envío si cambia | P0 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-154 | Edición | No se edita un confirmado ni se deja vacío | API | `PATCH /admin/orders/:id/items` | Pedido confirmado; otro pendiente | Editar el confirmado; enviar `items:[]` | — | 400; 400 | P1 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-155 | Edición | Ediciones simultáneas | Concurrencia | `PATCH /admin/orders/:id/items` ×2 | Pedido pendiente | Dos ediciones en paralelo | — | Una 200 y otra 409 "El pedido cambió…"; existencias coherentes | P0 | Sí · existe `test/orders-stock.e2e-spec.ts` | Pendiente |
| BE-156 | Cancelación | Cancelación manual con motivo | API | `PATCH /admin/orders/:id/cancel` (ADMIN) | Pedido confirmado | Motivo `"  a "`; motivo válido | — | 400; 200 `CANCELLED`, `cancelReason`, `cancelledAt`; `ORDER_RELEASED` por línea; avisos "antes" cerrados | P0 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-157 | Cancelación | No se cancela lo despachado ni lo entregado | API | `PATCH /admin/orders/:id/cancel` (ADMIN) | Pedidos `SHIPPED`, `DELIVERED`, `CANCELLED` | Cancelar | — | 400 en los tres | P0 | Sí · existe `test/orders-admin.e2e-spec.ts` | Pendiente |
| BE-158 | Cancelación | Cancelar un pedido con pago verificado exige la devolución | Integración | `PATCH /admin/orders/:id/cancel` (ADMIN), `…/payment/refund` | Pedido `CONFIRMED` con `PAID` | Cancelar sin devolución; registrar la devolución; cancelar | — | Nunca queda un pedido `CANCELLED` con `PAID` (Q-05, 2026-10-15). Recomendado: 400 sin devolución; tras `REFUNDED`, 200. Hoy se cancela sin devolución (H-10) | P1 | Sí · nueva | Pendiente |
| BE-159 | Cancelación | Confirmar y cancelar a la vez; cancelaciones dobles | Concurrencia | `confirm` + `cancel`; `cancel` ×2 | Pedido pendiente | Paralelo | — | Estado final coherente; existencias liberadas una sola vez | P0 | Sí · existe `test/orders-admin.e2e-spec.ts`, `test/orders-stock.e2e-spec.ts` | Pendiente |
| BE-160 | Auditoría | Toda acción deja evento con autor | Integración | Todas las acciones de pedido | Pedido | Ejecutar cada acción | — | `OrderStatusHistory` con `type`, `fromStatus`, `toStatus`, `note` y `changedById` (null solo para sistema) | P1 | Sí · nueva | Pendiente |

### C.12 Pagos

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-161 | Pagos | El personal registra el comprobante; solo la propietaria verifica | API | `PATCH …/payment-received` (STAFF), `…/payment/verify` (STAFF y ADMIN) | Pedido confirmado por transferencia | Registrar; verificar como STAFF; verificar como ADMIN | `{reference}` | 200 `AWAITING_VERIFICATION` + `PaymentRecord`; 403; 200 `PAID` con `paidAt` | P0 | Sí · existe `test/payments.e2e-spec.ts` | Pendiente |
| BE-162 | Pagos | Contra entrega no admite comprobante ni verificación | API | `…/payment-received`, `…/payment/verify`, `…/payment/reject` | Pedido COD | Llamar cada una | — | 400 en todas | P0 | Sí · existe `test/payments.e2e-spec.ts` | Pendiente |
| BE-163 | Pagos | Sin comprobantes en cancelados | API | `…/payment-received` | Pedido cancelado | Registrar | — | 400 | P1 | Sí · existe `test/payments.e2e-spec.ts` | Pendiente |
| BE-164 | Pagos | Sin comprobante sobre pago verificado o devuelto | API | `…/payment-received` | Pedidos `PAID` y `REFUNDED` | Registrar | — | 400 "ya no admite registro de comprobante" | P1 | Sí · nueva | Pendiente |
| BE-165 | Pagos | Caracterización: comprobante antes de confirmar | API | `…/payment-received` | Pedido `PENDING_CONFIRMATION` | Registrar | — | Documentar: hoy se acepta. Resultado según Q-06 | P2 | Sí · nueva (caracterización) | Pendiente |
| BE-166 | Pagos | Rechazo y plazo de aclaración de 8 horas | API | `…/payment/reject` (ADMIN), `…/cancel` (STAFF) | Pedido con comprobante | Rechazar sin motivo; con motivo; STAFF cancela a las 7 h 59 min y a las 8 h | — | 400; 200 `REJECTED` con `paymentRejectedAt`; 403; 200 | P0 | Sí · existe `test/payments.e2e-spec.ts` | Pendiente |
| BE-167 | Pagos | Nuevo comprobante durante la aclaración | API | `…/payment-received` | Pago `REJECTED` | Registrar de nuevo | — | `AWAITING_VERIFICATION`; `paymentRejectedAt=null`; aviso de pago no demostrado descartado | P0 | Sí · existe `test/payments.e2e-spec.ts` | Pendiente |
| BE-168 | Pagos | Verificar y rechazar a la vez | Concurrencia | `verify` + `reject` | Comprobante registrado | Paralelo | — | Solo una se aplica; la otra 409/400 | P0 | Sí · existe `test/payments.e2e-spec.ts` | Pendiente |
| BE-169 | Pagos | Solo se verifica con comprobante recibido | API | `…/payment/verify` | Pago `PENDING`; pago `REJECTED` | Verificar | — | 400 en ambos | P0 | Sí · nueva | Pendiente |
| BE-170 | Pagos | Monto verificado distinto del total | API | `…/payment/verify` (ADMIN) | Total 50.000 | Verificar con 30.000, 50.000 y 51.000 | — | Recomendación (§D.3, Q-04): 30.000 → 400 (se rechaza como pago incompleto para abrir el plazo de aclaración); 50.000 → `PAID`; 51.000 → `PAID` con nota obligatoria del excedente a devolver. Hoy acepta cualquier monto (H-09) | P1 | Sí · nueva | Bloqueado (Q-04: recomendación por confirmar) |
| BE-171 | Devoluciones | Devolución sin superar lo pagado y una sola vez | API | `…/payment/refund` (ADMIN) | Pago verificado de 50.000 | Devolver 50.001; 50.000; repetir; dos en paralelo | `{amount, note}` | 400; 200 `REFUNDED`; 400; solo una se registra | P0 | Sí · existe `test/payments.e2e-spec.ts` | Pendiente |
| BE-172 | Devoluciones | Devolución parcial | API | `…/payment/refund` | Pago de 50.000 | Devolver 10.000; devolver 50.000 | — | Recomendación (§D.3, Q-04): por ahora solo devoluciones totales; 10.000 → 400; 50.000 → `REFUNDED`. Hoy la parcial deja `REFUNDED` (H-09) | P2 | Sí · nueva | Bloqueado (Q-04: recomendación por confirmar) |
| BE-173 | Devoluciones | Solo sobre pagos verificados | API | `…/payment/refund` | Pago `PENDING` | Devolver | — | 400 | P1 | Sí · nueva | Pendiente |
| BE-174 | Pagos | Plazo de aclaración en 0 | Unitaria | `staffCanCancelRejected` | `ORDER_PAYMENT_CLARIFICATION_HOURS=0` | Evaluar un rechazo antiguo | — | `false` (el personal nunca cancela) | P3 | Sí · nueva | Pendiente |

### C.13 Envíos y transportadoras

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-175 | Transportadoras | Gestión por el personal con plantilla segura | API | `POST/PATCH /admin/carriers` (STAFF) | — | Crear; nombre repetido; plantilla sin `{tracking}`; plantilla `javascript:alert(1)/{tracking}` | — | 201; 409; 400; 400 (solo `http(s)`) | P1 | Parcial · existe `test/shipping.e2e-spec.ts` (falta `javascript:`) | Pendiente |
| BE-176 | Envío | Despacho por transportadora exige transportadora y guía | API | `PATCH /admin/orders/:id/shipping` | Pedido confirmado | `IN_TRANSIT` sin guía; con transportadora y guía | — | 400; 200: pedido `SHIPPED`, `dispatchedAt` fijado, eventos de envío y de estado | P0 | Sí · existe `test/shipping.e2e-spec.ts` | Pendiente |
| BE-177 | Envío | Entrega local sin transportadora ni guía | API | `PATCH /admin/orders/:id/shipping` | Pedido confirmado | `method=LOCAL` con `carrierId` y guía; avanzar a `DELIVERED` | — | Se descartan transportadora y guía; pedido `DELIVERED` | P0 | Sí · existe `test/shipping.e2e-spec.ts` | Pendiente |
| BE-178 | Envío | Transiciones del envío | API | `PATCH /admin/orders/:id/shipping` | Envíos en cada estado | Probar la tabla `NEXT_SHIPPING_STATUSES` completa | — | Permitidas → 200; `DELIVERED` a otro estado → 400; corregir datos de un entregado → 200 | P1 | Sí · existe `test/shipping.e2e-spec.ts` | Pendiente |
| BE-179 | Envío | Validaciones de fechas y estado del pedido | API | `PATCH /admin/orders/:id/shipping` | Pedido sin confirmar; cancelado | Despachar; registrar entrega anterior al despacho | — | 400 en todos | P1 | Sí · existe `test/shipping.e2e-spec.ts` | Pendiente |
| BE-180 | Envío | Transportadora desactivada | API | `PATCH /admin/orders/:id/shipping` | Transportadora inactiva | Elegirla en un pedido nuevo; corregir un envío que ya la usa | — | 400; 200 | P2 | Sí · existe `test/shipping.e2e-spec.ts` | Pendiente |
| BE-181 | Envío | Contra entrega pagado al entregarse, una sola vez | API | `PATCH /admin/orders/:id/shipping` (STAFF) | Pedido COD despachado | Marcar `DELIVERED` dos veces | — | `PAID` con `paidAt` y un solo `PaymentRecord` por `order.total` | P0 | Sí · existe `test/shipping.e2e-spec.ts` | Pendiente |
| BE-182 | Envío | Despachar y cancelar a la vez | Concurrencia | `shipping` + `cancel` | Pedido confirmado | Paralelo | — | Estado final coherente (despachado sin liberar stock, o cancelado sin envío en tránsito) | P0 | Sí · existe `test/shipping.e2e-spec.ts` | Pendiente |
| BE-183 | Envío | Guía con caracteres especiales en la URL de rastreo | Unitaria | Armado de `trackingUrl` | Plantilla `https://t.test/?g={tracking}` | Guía `AB 12/&?#` | — | Guía codificada con `encodeURIComponent` | P2 | Sí · nueva | Pendiente |

### C.14 Seguimiento y rastreador público

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-184 | Seguimiento | Información del pedido sin datos del cliente ni internos | API | `GET /store/orders/tracking/:token` (anónimo) | Pedido despachado | Consultar | — | Código, fecha, estados, pago, envío, productos y totales según la decisión del 2026-10-13; sin nombre, teléfono, dirección, notas ni costos | P0 | Sí · existe `test/order-tracking.e2e-spec.ts` | Pendiente |
| BE-185 | Seguimiento | Enlace inválido no revela nada | API | `GET /store/orders/tracking/:token` | — | Token corto, no hexadecimal, de 48 hex inexistente | — | El mismo 404 genérico en todos | P0 | Sí · existe `test/order-tracking.e2e-spec.ts` | Pendiente |
| BE-186 | Seguimiento | El token no se deriva de datos del pedido | Unitaria | `publicTokenFor` | Dos secretos distintos | Calcular para la misma clave | — | 48 hex; distinto por secreto; estable para la misma clave | P1 | Sí · nueva | Pendiente |
| BE-187 | Rastreador | Código y teléfono correctos | API | `POST /store/orders/lookup` | Pedido con `573001234567` | Enviar `300 123 4567` y el código en minúsculas con espacios | — | 200 `{trackingPath}` del pedido | P0 | Parcial · existe `test/order-tracking.e2e-spec.ts` | Pendiente |
| BE-188 | Rastreador | Datos que no coinciden | API | `POST /store/orders/lookup` | — | Código bien y teléfono mal; al revés; ambos mal | — | El mismo 404 "No encontramos un pedido con esos datos." | P0 | Sí · existe `test/order-tracking.e2e-spec.ts` | Pendiente |
| BE-189 | Rastreador | Máximo 5 intentos por minuto | API | `POST /store/orders/lookup` ×6 | Limitador activo | 6 intentos | — | 6.º → 429 | P0 | Sí · existe `test/lookup-throttle.e2e-spec.ts` | Pendiente |
| BE-190 | Seguimiento | Aviso visible en el seguimiento | API | `GET /store/orders/tracking/:token` | Aviso "antes" pendiente; luego pedido cancelado | Consultar en cada momento | — | `notice.stage=BEFORE` con fecha exacta y sin saludo con nombre; luego `AFTER` | P1 | Parcial · existe `test/notices.e2e-spec.ts` | Pendiente |

### C.15 Plazos automáticos, avisos y notificaciones

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-191 | Plazos | Sin confirmar a las 48 horas | Integración | `NoticesService.runCycle(now)` | Pedido pendiente | Ciclo a las 47 h y a las 48 h | — | 47 h: aviso `UNCONFIRMED/BEFORE` + notificación; 48 h: `CANCELLED` con motivo automático, stock liberado, aviso `AFTER`, notificación `ORDER_AUTO_CANCELLED`, aviso "antes" `EXPIRED` si no se envió | P0 | Sí · existe `test/notices.e2e-spec.ts` | Pendiente |
| BE-192 | Plazos | Confirmado a tiempo | Integración | `runCycle` | Aviso "antes" pendiente | Confirmar y correr el ciclo | — | Aviso `DISCARDED`; no se cancela | P0 | Sí · existe `test/notices.e2e-spec.ts` | Pendiente |
| BE-193 | Plazos | Confirmado sin comprobante a las 24 horas | Integración | `runCycle` | Pedidos confirmados: sin comprobante; con comprobante; COD | Ciclo a las 24 h de `confirmedAt` | — | Solo el primero se cancela | P0 | Sí · existe `test/notices.e2e-spec.ts` | Pendiente |
| BE-194 | Plazos | Pago no demostrado: avisa pero no cancela solo | Integración | `runCycle` → `cancel` | Pago rechazado | Ciclo a las 7 h y a las 9 h; cancelar a mano | — | Aviso "antes" a las 7 h; sigue sin cancelar a las 9 h; al cancelar se crea aviso `AFTER` | P0 | Sí · existe `test/notices.e2e-spec.ts` | Pendiente |
| BE-195 | Plazos | Ciclos simultáneos | Concurrencia | `runLocked` ×2 | Pedidos vencidos | Dos ciclos en paralelo | — | Sin avisos ni cancelaciones duplicados; uno devuelve `null` | P0 | Sí · existe `test/notices.e2e-spec.ts` | Pendiente |
| BE-196 | Plazos | Exactamente en el vencimiento | Integración | `runCycle(now)` | Pedido pendiente | `now = createdAt + 48 h − 1 ms` y `= createdAt + 48 h` | — | Primero no cancela; segundo cancela | P1 | Sí · nueva | Pendiente |
| BE-197 | Plazos | Plazos desactivados con 0 | Integración | `runCycle` | `ORDER_PENDING_TTL_HOURS=0`, `ORDER_UNPAID_TTL_HOURS=0` | Ciclo sobre pedidos antiguos | — | Sin avisos ni cancelaciones de esos casos | P2 | Sí · nueva | Pendiente |
| BE-198 | Plazos | Caracterización: pedido en preparación sin comprobante | Integración | `runCycle` | Pedido `PREPARING` con pago `PENDING` | Ciclo a las 24 h | — | Documentar: se cancela (el código incluye `PREPARING`). Confirmar con Q-19 | P2 | Sí · nueva (caracterización) | Pendiente |
| BE-199 | Avisos | Bandeja y marcado como enviado | API | `GET /admin/notices`, `PATCH /admin/notices/:id/sent` (STAFF) | Avisos pendientes | Listar; marcar; marcar de nuevo; id inexistente | — | Pendientes del más antiguo al más reciente, con `whatsappUrl` al teléfono del cliente; 204; 409; 404 | P1 | Parcial · existe `test/notices.e2e-spec.ts` | Pendiente |
| BE-200 | Notificaciones | Lectura independiente por usuario | API | `GET /admin/notifications`, `PATCH …/:id/read`, `PATCH …/read-all` | Dos usuarios | Leer una con A; leer todas con B; repetir `read-all` | — | Contadores independientes; `read-all` idempotente | P2 | Sí · existe `test/notices.e2e-spec.ts` | Pendiente |
| BE-201 | Plazos | Comando manual del ciclo | Integración | CLI `orders:run-deadlines` | Pedido vencido; otra instancia con el bloqueo | Ejecutar | — | Imprime el resumen; con el bloqueo tomado informa "Otra instancia…" y no procesa | P2 | Sí · nueva | Pendiente |
| BE-202 | Plazos | El ciclo no corre en pruebas | Unitaria | `NoticesService.tick`, `SessionService.purgeExpiredDaily` | `NODE_ENV=test` | Invocar | — | No consulta la base | P3 | Sí · nueva | Pendiente |

### C.16 Reportes, resumen y testimonios

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-203 | Reportes | Solo la propietaria | API | `/admin/reports/*` (STAFF) | — | Consultar | — | 403 | P0 | Sí · existe `test/reports.e2e-spec.ts` | Pendiente |
| BE-204 | Reportes | Validación del rango | API | `GET /admin/reports/sales?from&to` | — | Formato inválido; `to < from`; más de 3 años | — | 400 en todos | P1 | Sí · existe `test/reports.e2e-spec.ts` | Pendiente |
| BE-205 | Reportes | Qué cuenta como venta | Integración | `GET /admin/reports/sales` | Pedidos `PAID`, `PAID`+cancelado, `REFUNDED`, `AWAITING_VERIFICATION`, COD entregado | Consultar | — | Solo `PAID` no cancelados (incluye COD pagado); según decisión del 2026-10-13 | P0 | Sí · existe `test/reports.e2e-spec.ts` | Pendiente |
| BE-206 | Reportes | Días en hora de Colombia y fecha de verificación | Integración | `GET /admin/reports/sales` | Pago verificado a las 23:30 −05:00 de un pedido de días antes | Consultar ese día | — | La venta cae en el día de `paidAt` en hora de Colombia, con ambos extremos incluidos | P0 | Sí · existe `test/reports.e2e-spec.ts` | Pendiente |
| BE-207 | Reportes | Agrupación y períodos vacíos | API | `GET /admin/reports/sales?groupBy=` | Ventas dispersas | `day`, `week`, `month`, `year` | — | Series completas con ceros; `year` → 400 | P1 | Sí · existe `test/reports.e2e-spec.ts` | Pendiente |
| BE-208 | Reportes | Ganancia de productos y envío aparte | Integración | `GET /admin/reports/margins`, `/top-products` | Ítems con y sin `unitCost`; envío cobrado y costo real | Consultar | — | Ganancia = ventas netas − costo; sin costo se informa aparte; envío separado; más vendidos por unidades | P1 | Sí · existe `test/reports.e2e-spec.ts` | Pendiente |
| BE-209 | Reportes | Parámetros maliciosos en SQL crudo | Seguridad | `GET /admin/reports/sales` | — | `groupBy=day');DROP TABLE "Order";--`; `from=2026-01-01' OR '1'='1` | — | 400 por validación; tablas intactas | P1 | Sí · nueva | Pendiente |
| BE-210 | Resumen | Pendientes del día | API | `GET /admin/dashboard/pending` (STAFF y ADMIN) | Pedidos por confirmar, pagos por verificar, avisos, stock bajo | Consultar | — | Cifras iguales a las de cada sección | P1 | Sí · existe `test/dashboard.e2e-spec.ts` | Pendiente |
| BE-211 | Testimonios | Solo la propietaria escribe | API | `/admin/testimonials` (STAFF) | — | Crear, editar, borrar; listar | — | 403 en escritura; 200 en lectura | P1 | Sí · existe `test/testimonials.e2e-spec.ts` | Pendiente |
| BE-212 | Testimonios | Validaciones | API | `POST /admin/testimonials` (ADMIN) | — | `rating` 0 y 6; `lastInitial` "Ga"; comentario de 601; producto inexistente | — | 400 en todos | P1 | Sí · existe `test/testimonials.e2e-spec.ts` | Pendiente |
| BE-213 | Testimonios | Publicación en la tienda | API | `GET /store/testimonials` (anónimo) | 8 publicados, 1 oculto; uno con producto inactivo | Consultar | — | 6 más recientes; nombre "María G."; producto solo si sigue activo | P1 | Sí · existe `test/testimonials.e2e-spec.ts` | Pendiente |

### C.17 Base de datos, datos iniciales y scripts

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-214 | BD | Migraciones desde cero y sin deriva | Base de datos | `prisma migrate deploy`, `prisma migrate diff` | Base vacía | Aplicar las 19 migraciones; comparar con `schema.prisma` | — | Sin errores; sin diferencias entre migraciones y esquema | P0 | Sí · nueva | Pendiente |
| BE-215 | BD | Las restricciones `CHECK` rechazan filas inválidas | Base de datos | SQL directo | Base migrada | Insertar stock negativo, pedido con total descuadrado, cancelado sin motivo, `rating=6`, movimiento con `stockAfter` incoherente | — | Cada inserción falla con la restricción de A.3 | P1 | Sí · nueva | Pendiente |
| BE-216 | Datos iniciales | Seed idempotente | Integración | `seed()` | Base vacía; luego con configuración editada | Ejecutar dos veces | Variables `SEED_OWNER_*` ficticias | Configuración vacía, 4 métodos inactivos (COD restringido sin municipios), propietaria solo si no hay ADMIN; no sobrescribe | P1 | Sí · existe `test/seed.e2e-spec.ts` | Pendiente |
| BE-217 | Scripts | Los datos de demostración no corren en producción | Unitaria | `prisma/demo/demo-common.ts` | `NODE_ENV=production` | Ejecutar `db:demo` y `db:demo:clean` | — | Error "no se cargan ni se borran en producción" | P1 | Sí · nueva | Pendiente |
| BE-218 | Scripts | Las pruebas nunca usan la base de desarrollo | Unitaria | `test/setup-env.ts`, `test/e2e-fixtures.ts` | `TEST_DATABASE_URL` igual a `DATABASE_URL`; URL sin `_test` | Iniciar las suites | — | Se detienen con error antes de conectar | P0 | Sí · nueva | Pendiente |

### C.18 Seguridad adicional (OWASP)

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-219 | Seguridad | No hay forma pública de listar pedidos ni clientes | Seguridad | `GET /store/orders`, `GET /store/orders/:id`, `GET /store/customers` | — | Enviar | — | 404 en todas | P0 | Sí · nueva | Pendiente |
| BE-220 | Seguridad | Inyección en búsquedas del panel | Seguridad | `GET /admin/orders?q=`, `/admin/products?q=`, `/admin/inventory/variants?q=` | Datos de prueba | `q=' OR 1=1 --`, `q=%`, `q=\\` | — | 200 tratado como texto literal; sin errores ni fuga de filas | P1 | Sí · nueva | Pendiente |
| BE-221 | Seguridad | Contaminación de prototipo y tipos inesperados | Seguridad | `POST /store/orders`, `PATCH /admin/settings` | — | Cuerpo con `__proto__`, `constructor`, arrays en lugar de cadenas | — | 400; la configuración no cambia | P2 | Sí · nueva | Pendiente |
| BE-222 | Seguridad | Asignación masiva en recursos del panel | Seguridad | `PATCH /admin/settings`, `PATCH /admin/products/:id`, `PATCH /admin/products/:productId/variants/:id`, `POST /admin/users` | Sesión ADMIN | Enviar `id`, `stock`, `status`, `isDemo`, `publishedAt`, `role` | — | 400 (campos no permitidos); `stock` solo cambia por inventario | P0 | Sí · nueva | Pendiente |
| BE-223 | Seguridad | Protección CSRF de la cookie | Seguridad | `PATCH /admin/settings` desde otro origen | Sesión ADMIN en el navegador | Formulario `POST` de otro sitio y `fetch` con `credentials:'include'` desde otro origen | — | Sin cookie (`SameSite=Lax`) o bloqueado por CORS; sin cambios | P1 | Sí · nueva (Playwright con dos orígenes) | Pendiente |
| BE-224 | Seguridad | Nombres de archivo y rutas en fotos | Seguridad | `POST …/images`, `GET /uploads/../.env` | — | Subir con nombre `../../x.png`; pedir rutas con `..` | — | El archivo se guarda con UUID; `..` → 404 | P2 | Sí · nueva | Pendiente |
| BE-225 | Seguridad | Token de seguimiento en logs (H-17) | Revisión | Logs de pino-http | `LOG_LEVEL=info` | Consultar un seguimiento y revisar el log | — | Documentar si la URL con token queda registrada. Resultado según Q-17 | P2 | No (revisión) | Pendiente |
| BE-226 | Seguridad | Dependencias sin vulnerabilidades altas | Seguridad | `npm audit --omit=dev` | — | Ejecutar en `backend/` | — | Sin vulnerabilidades altas o críticas sin justificar | P1 | Sí · nueva (CI) | Pendiente |

### C.19 Rendimiento y carga

Requieren datos ficticios en volumen y un entorno aislado. Las metas son **propuestas** hasta resolver Q-15.

| ID | Módulo | Escenario | Tipo | Endpoint (acceso) | Precondiciones | Pasos | Datos / payload | Resultado esperado (HTTP · respuesta · BD) | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BE-227 | Rendimiento | Catálogo bajo carga | Carga | `GET /store/products?page=1&limit=20` | 500 productos, 1.500 variantes, 30 promociones | 50 conexiones durante 60 s con clave interna | — | p95 < 500 ms; 0 errores | P2 | Sí · nueva (`perf/`) | Pendiente |
| BE-228 | Rendimiento | Búsqueda y ofertas con catálogo grande (H-14) | Carga | `GET /store/products?q=`, `?onSale=true` | 2.000 productos activos | 20 conexiones durante 60 s | — | p95 < 1 s; memoria estable. Si no se cumple, revisar la estrategia en memoria | P2 | Sí · nueva | Pendiente |
| BE-229 | Rendimiento | Cotización y checkout simultáneos | Carga | `POST /store/orders/quote`, `POST /store/orders` | Stock amplio; limitador apagado | 30 pedidos simultáneos con IPs/claves distintas | — | Sin interbloqueos ni 500; p95 de creación < 1,5 s | P1 | Sí · nueva | Pendiente |
| BE-230 | Rendimiento | Inventario sin paginación (H-14) | Carga | `GET /admin/inventory/variants` | 5.000 variantes | 10 peticiones | — | p95 < 1 s; si no, paginar | P3 | Sí · nueva | Pendiente |
| BE-231 | Rendimiento | Ciclo de plazos con volumen | Carga | `runLocked(now)` | 5.000 pedidos vencidos | Ejecutar un ciclo | — | Termina antes de 5 min (tiempo máximo de la transacción) sin error | P2 | Sí · nueva | Pendiente |
| BE-232 | Rendimiento | Subida de fotos simultáneas | Carga | `POST …/images` ×10 | Fotos de 4 MB | 10 subidas en paralelo | — | Todas 2xx; memoria del proceso acotada | P3 | Sí · nueva | Pendiente |

---

## D. Pruebas críticas de negocio

### D.1 Mapa de riesgos de negocio a casos

| Riesgo crítico | Regla de negocio (fuente) | Casos |
|---|---|---|
| Vender sin inventario | Existencias por variante; reserva al crear el pedido (`decisiones.md` 2026-10-09) | BE-115, BE-127, BE-128, BE-129, BE-093, BE-095, BE-136 |
| Cantidades o precios inválidos | Precios del servidor; 1–999 unidades; tope por pedido | BE-008, BE-114, BE-117, BE-119, BE-141, BE-106, BE-107 |
| Descuentos y totales incorrectos | Promociones no acumulables, mayor descuento, empate por creación | BE-105, BE-108, BE-109, BE-112, BE-142 |
| Envío mal calculado | Prioridad nacional > monto mínimo > tarifa > por confirmar | BE-120, BE-121, BE-122, BE-153 |
| Datos de clientes expuestos | Seguimiento sin datos del cliente; rastreador con mensaje genérico | BE-038, BE-184, BE-185, BE-188, BE-189, BE-219 |
| Acceso administrativo no autorizado | Panel restringido; permisos de STAFF | BE-023 a BE-027, BE-032 a BE-037, BE-040, BE-044 |
| Pedidos duplicados | Idempotencia del checkout | BE-130, BE-131, BE-132 |
| Cobros o devoluciones duplicados | Bloqueo optimista en pagos | BE-168, BE-171, BE-181 |
| Integridad transaccional | Pedido, reserva y movimientos en una transacción | BE-124, BE-127, BE-098, BE-142, BE-159, BE-182 |
| Concurrencia sobre inventario | Incremento atómico | BE-095, BE-096, BE-128, BE-129, BE-155 |
| Plazos y cancelaciones automáticas | 48 h, 24 h, 8 h; avisos antes y después | BE-191 a BE-198 |
| Paginación, filtros y límites | — | BE-083, BE-084, BE-100, BE-119, BE-144, BE-145 |
| Entradas malformadas | `ValidationPipe` estricto | BE-022, BE-068, BE-073, BE-119, BE-134, BE-221 |
| Webhooks y reintentos de terceros | No existen integraciones con webhooks | No aplicable (ver A.7) |

### D.2 Seguridad basada en OWASP Top 10 (2021) aplicable

| Categoría OWASP | Aplicación en Sky Beauty | Casos |
|---|---|---|
| A01 Control de acceso roto | Guardia global, `@Roles`, excepciones del personal, datos públicos | BE-032 a BE-039, BE-044, BE-219 |
| A02 Fallas criptográficas | argon2id, JWT con secreto ≥ 32, token HMAC, cookie `Secure` en producción | BE-014, BE-024, BE-186 |
| A03 Inyección | Prisma parametrizado; SQL crudo en reportes y resumen; textos guardados literales | BE-056, BE-088, BE-140, BE-209, BE-220 |
| A04 Diseño inseguro | Precio 0 (no permitido), montos de pago libres, cancelación de pedidos pagados | BE-102, BE-106, BE-107, BE-158, BE-170 |
| A05 Configuración insegura | Swagger, CORS, helmet, errores sin detalle, `TRUST_PROXY_HOPS` | BE-005 a BE-012 |
| A06 Componentes vulnerables | Dependencias | BE-226 |
| A07 Fallas de identificación y autenticación | Bloqueo, límite por IP, sesiones revocables, enumeración | BE-015 a BE-021, BE-024 a BE-028 |
| A08 Integridad de software y datos | Idempotencia, historial inmutable, migraciones | BE-130 a BE-132, BE-098, BE-214 |
| A09 Registro y monitoreo | Redacción de secretos, token en logs, eventos de pedido con autor | BE-010, BE-160, BE-225 |
| A10 SSRF | El backend no hace peticiones salientes con URLs del usuario | No aplicable |

### D.3 Decisiones del 2026-10-15 y recomendación para Q-04

Respuestas de la persona usuaria a las preguntas del plan maestro, registradas en `Context/decisiones.md` el 2026-10-15.

| Pregunta | Respuesta | Efecto en el plan | ¿Requiere cambiar código? |
|---|---|---|---|
| Q-01 ¿La API debe dejar de enviar el stock exacto? | **No** | BE-039 y BE-118 se desbloquean como pruebas de contrato; FE-034 sigue exigiendo que la interfaz no muestre la cantidad | No |
| Q-02 ¿Se permite un precio final de 0? | **No** | BE-068, BE-073, BE-102, BE-106 a BE-108, BE-111 y BE-143 esperan que se impida | **Sí**: hoy se permite (`@Min(0)` en precios, 100 % aceptado, descuento fijo sin tope, redondeo). Dos pruebas existentes lo contradicen: `pricing.service.spec.ts` y `promotions.e2e-spec.ts` |
| Q-03 ¿Se puede cambiar el envío después del pago? | **Sí** | BE-149 pasa a prueba positiva | No |
| Q-04 Monto verificado distinto y devoluciones parciales | **Pidió recomendación** (abajo) | BE-170 y BE-172 quedan bloqueados hasta confirmarla | Sí, si se acepta |
| Q-05 ¿Cancelar un pedido pagado exige la devolución? | **Sí** | BE-158 espera que nunca quede `CANCELLED` + `PAID` | **Sí**: hoy se cancela sin devolución |

**Recomendación para Q-04** (no es una decisión hasta que se confirme):

1. **Verificar el pago:** el monto propuesto es el total del pedido.
   - Si el cliente pagó **menos**, no se marca como pagado: se usa "Rechazar" con el motivo "pago incompleto". Así corre el plazo de aclaración de 8 horas que ya existe y el cliente completa la diferencia con un nuevo comprobante.
   - Si pagó **más**, se marca como pagado por el total y se exige una nota con el excedente, que se devuelve fuera del sistema.
   - Motivo: la tienda verifica comprobantes a mano; aceptar montos parciales como "pagado" infla los reportes y oculta deudas.
2. **Devoluciones:** por ahora solo devoluciones **totales** (el monto debe ser igual a lo pagado). Las parciales dependen de la política de cambios y devoluciones, que sigue en borrador, y de un movimiento de inventario `RETURN` que hoy no registra ningún flujo. Cuando se apruebe la política, se diseñan juntas.
3. Con la respuesta a Q-05, el orden en el panel para cancelar un pedido pagado es: **registrar la devolución total → cancelar**.

**Mecanismo pendiente para Q-02 (Q-22).** Las pruebas verifican el resultado (ningún precio final 0), no el mecanismo. Recomendado:

- rechazar con 400 los precios base o de variante en 0 y las promociones del 100 %;
- rechazar con 400 una promoción fija que deje algún destino en 0 o menos al guardarla;
- si después baja el precio de una variante por debajo de una promoción fija vigente, el motor no aplica esa promoción a esa variante;
- el redondeo nunca baja el precio final de 1 COP.

---

## E. Matriz de pruebas

Las tablas de la sección C son la matriz completa (BE-001 a BE-232). Resumen:

| Dominio | Rango | Casos | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|---|
| C.1 Plataforma | BE-001 – BE-013 | 13 | 1 | 7 | 5 | 0 |
| C.2 Autenticación | BE-014 – BE-031 | 18 | 9 | 5 | 3 | 1 |
| C.3 Permisos | BE-032 – BE-039 | 8 | 7 | 1 | 0 | 0 |
| C.4 Cuentas | BE-040 – BE-046 | 7 | 3 | 3 | 0 | 1 |
| C.5 Configuración | BE-047 – BE-056 | 10 | 1 | 8 | 1 | 0 |
| C.6 Métodos de pago y ubicaciones | BE-057 – BE-062 | 6 | 1 | 3 | 2 | 0 |
| C.7 Catálogo | BE-063 – BE-090 | 28 | 4 | 13 | 10 | 1 |
| C.8 Inventario | BE-091 – BE-100 | 10 | 6 | 2 | 1 | 1 |
| C.9 Promociones y precios | BE-101 – BE-113 | 13 | 6 | 4 | 1 | 2 |
| C.10 Checkout | BE-114 – BE-143 | 30 | 20 | 9 | 1 | 0 |
| C.11 Gestión de pedidos | BE-144 – BE-160 | 17 | 9 | 7 | 1 | 0 |
| C.12 Pagos | BE-161 – BE-174 | 14 | 7 | 4 | 2 | 1 |
| C.13 Envíos | BE-175 – BE-183 | 9 | 4 | 3 | 2 | 0 |
| C.14 Seguimiento | BE-184 – BE-190 | 7 | 5 | 2 | 0 | 0 |
| C.15 Plazos y avisos | BE-191 – BE-202 | 12 | 5 | 2 | 4 | 1 |
| C.16 Reportes, resumen y testimonios | BE-203 – BE-213 | 11 | 3 | 8 | 0 | 0 |
| C.17 Base de datos y scripts | BE-214 – BE-218 | 5 | 2 | 3 | 0 | 0 |
| C.18 Seguridad | BE-219 – BE-226 | 8 | 2 | 3 | 3 | 0 |
| C.19 Rendimiento | BE-227 – BE-232 | 6 | 0 | 1 | 3 | 2 |
| **Total** | BE-001 – BE-232 | **232** | **95** | **88** | **39** | **10** |

Estado: 230 casos **Pendiente** y 2 **Bloqueado** (BE-170 y BE-172, a la espera de confirmar la recomendación de Q-04).

> Los totales por prioridad se recalculan en [`PLAN_MAESTRO_QA.md` §D](PLAN_MAESTRO_QA.md#d-priorización) a partir de las tablas; si difieren, prevalecen las tablas.

---

## F. Automatización

### F.1 Framework

Mantener lo que ya existe y funciona: **Jest 30 + ts-jest** (unitarias en `src/**/*.spec.ts`), **Jest + Supertest + `@nestjs/testing`** (integración en `test/*.e2e-spec.ts`, `--runInBand`). No se recomienda cambiar de framework.

### F.2 Organización propuesta

```text
backend/
├── src/**/<archivo>.spec.ts           # unitarias junto al código (ya existe el patrón)
└── test/
    ├── utils/
    │   ├── app.ts                     # existe: createTestApp, createAdminUser, loginAgent
    │   ├── database.ts                # existe: resetDatabase
    │   ├── factories.ts               # NUEVO: builders de marca, categoría, producto, variante, pedido
    │   ├── invariants.ts              # NUEVO: BE-098 y BE-142, se llama en afterEach de suites críticas
    │   └── clock.ts                   # NUEVO: fechas controladas para plazos y promociones
    ├── permissions.e2e-spec.ts        # NUEVO: BE-032 a BE-039 guiado por la tabla A.5
    ├── security.e2e-spec.ts           # NUEVO: BE-008, BE-141, BE-219 a BE-224
    ├── db-integrity.e2e-spec.ts       # NUEVO: BE-054, BE-062, BE-214, BE-215
    └── <dominio>.e2e-spec.ts          # existentes, ampliar con los casos "Parcial"
perf/                                   # NUEVO, fuera de la suite normal: BE-227 a BE-232
```

### F.3 Fixtures y factories

- Hoy cada suite arma sus datos a mano (llamadas a Prisma y a la API). Crear `factories.ts` con funciones `crearProducto({variantes, stock, precio})`, `crearPedido({estado, pago, metodo})` que **usen la API** cuando la regla importe (historial de precios, movimientos) y Prisma directo solo para preparar estados difíciles (fechas pasadas).
- Datos evidentemente ficticios: correos `*@ejemplo.test`, teléfonos `573000000001…`, SKU `TEST-…`, nombres "Producto de prueba".

### F.4 Datos de prueba y aislamiento de base de datos

- Base `sky_beauty_test` separada (ya creada por `docker/postgres/init-test-db.sh`); `test/setup-env.ts` impide usar la de desarrollo (BE-218).
- `resetDatabase()` en `beforeEach`/`beforeAll` de cada suite; conserva DIVIPOLA.
- `--runInBand` es obligatorio: las suites comparten base. Para paralelizar en CI más adelante, usar un esquema o base por *worker* (`sky_beauty_test_<n>`).
- Fotos en carpeta temporal (`UPLOADS_DIR` con `mkdtemp`, ya implementado).

### F.5 Mocks de servicios externos

No hay servicios externos que simular (A.7). Solo se controlan:

- **Reloj:** pasar `now` a `runCycle`, `autoCancel`, `purgeExpired` y fechas a `priceVariantsAt`; para `Date.now()` interno usar `jest.useFakeTimers({ now })` en unitarias.
- **Configuración:** `ConfigService` con valores alternativos (plazos en 0, límites) creando el módulo con `ConfigModule.forRoot({ load: [...] })` o variables de entorno por suite.
- **Limitador:** las pruebas de límites necesitan una app con `NODE_ENV≠test` (ya lo hace `test/lookup-throttle.e2e-spec.ts`).

### F.6 Estrategia de cobertura

| Ámbito | Meta propuesta | Medición |
|---|---|---|
| `pricing.service.ts`, `orders.service.ts`, `inventory.service.ts`, `notice-records.ts`, `shared/*` | ≥ 90 % de líneas y ≥ 85 % de ramas | `npm run test:cov` combinando unitarias e integración (`--coverage` en `test:e2e`) |
| Resto de `src/modules` | ≥ 80 % de líneas | Igual |
| Casos P0 de este plan | 100 % automatizados | Trazabilidad ID → prueba (nombre del `it` con el ID) |

Recomendación: incluir el ID en el nombre de cada prueba nueva (`it('[BE-129] ráfaga de compradores…')`) para trazar ejecución y cobertura. Hoy no se mide cobertura ni hay umbral (H-16).

### F.7 Pipeline de CI/CD

No existe CI. Propuesta para GitHub (el repositorio está en `github.com/CrixxCode/sky-beauty-web`), sujeta a Q-12 por la regla de no usar servicios de pago:

```yaml
# .github/workflows/backend.yml (propuesta, no creada)
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env: { POSTGRES_USER: sky, POSTGRES_PASSWORD: ci, POSTGRES_DB: sky_beauty_test }
        ports: ['5432:5432']
    env:
      DATABASE_URL: postgresql://sky:ci@localhost:5432/sky_beauty_dev_unused
      TEST_DATABASE_URL: postgresql://sky:ci@localhost:5432/sky_beauty_test
      # Secretos de prueba generados en el job, nunca los de producción
    steps:
      - npm ci            # backend/
      - npm run lint && npm run typecheck
      - npm test          # unitarias
      - npm run test:db:prepare
      - npm run test:e2e  # integración (--runInBand)
      - npm audit --omit=dev --audit-level=high
```

Orden de ejecución: lint → typecheck → unitarias → migraciones → integración → auditoría de dependencias. Las pruebas de carga (C.19) se ejecutan a mano o en un flujo programado, nunca en cada cambio.
