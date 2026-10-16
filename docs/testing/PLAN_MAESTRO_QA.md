# Plan maestro de QA — Sky Beauty Maquillaje

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-10-15 |
| Rama analizada | `dev` (commit `aaa2566`) |
| Actualización | 2026-10-15: respuestas a Q-01 a Q-05 (ver §H.0) |
| Planes integrados | [`PLAN_PRUEBAS_FRONTEND.md`](PLAN_PRUEBAS_FRONTEND.md) (`FE-001` a `FE-144`) · [`PLAN_PRUEBAS_BACKEND.md`](PLAN_PRUEBAS_BACKEND.md) (`BE-001` a `BE-232`) |
| Identificadores propios | Escenarios `E2E-001` a `E2E-023`, humo `SMK-01` a `SMK-12`, riesgos `R-01` a `R-13`, hallazgos `H-01` a `H-21`, preguntas `Q-01` a `Q-22` |

> Este plan no inventa reglas de negocio. Los resultados esperados salen de `Context/negocio.md`, `Context/decisiones.md` y `Context/plan-desarrollo.md`. Donde el código hace algo que el contexto no decide, el caso es una **caracterización** y remite a una pregunta `Q-xx`. Ningún caso figura como aprobado o fallido: solo se ejecutaron las pruebas unitarias existentes (§A.1).

---

## A. Resumen ejecutivo

### A.1 Estado actual de las pruebas

| Suite existente | Herramienta | Tamaño | Ejecutada en esta auditoría | Resultado medido |
|---|---|---|---|---|
| Backend · unitarias (`src/**/*.spec.ts`) | Jest | 4 suites | Sí, 2026-10-15 | **40 de 40 aprobadas** |
| Backend · integración/API (`test/*.e2e-spec.ts`) | Jest + Supertest + PostgreSQL | 20 suites, ≈ 170 casos `it` | No (requiere PostgreSQL con `sky_beauty_test`) | Sin medir |
| Frontend · unitarias y componentes (`src/**/*.test.ts(x)`) | Jest + Testing Library | 10 suites | Sí, 2026-10-15 | **38 de 38 aprobadas** |
| Frontend · E2E (`e2e/*.spec.ts`) | Playwright (Pixel 7 y Desktop Chrome) | 15 archivos, 18 pruebas × 2 proyectos | No (requiere base y compilaciones) | Sin medir |
| Cobertura de código | — | — | No se mide | Sin medir |
| CI/CD | — | **No existe** | — | — |

**Lectura:** la base de pruebas es sólida para un proyecto de este tamaño. Las reglas críticas (reserva de stock, idempotencia, promociones, permisos, plazos, pagos) ya tienen pruebas de integración contra PostgreSQL real, incluidas pruebas de concurrencia. Lo que falta es **ejecutarlas de forma automática y obligatoria** (no hay CI), **medir cobertura**, cubrir **accesibilidad, compatibilidad (Safari/WebKit), responsive y rendimiento**, y **resolver las ambigüedades de negocio** detectadas (§A.3).

De los 399 casos de este plan (392 aplicables), 136 ya tienen una prueba automatizada que los cubre por completo y 67 parcialmente (detalle en §D). Dos pruebas existentes contradicen la respuesta a Q-02 y deben actualizarse cuando cambie el código (§H.0).

### A.2 Arquitectura identificada

```text
Navegador (celular primero)
   │  /api/v1/*  y  /uploads/*  (mismo dominio)
   ▼
Next.js 16 (App Router, React 19, Tailwind 4, shadcn/ui, TanStack Query)
   │  rewrites → API_INTERNAL_URL   ·   Server Components con x-internal-api-key
   ▼
NestJS 11 (REST /api/v1, AuthGuard global, Throttler, helmet, ValidationPipe estricto,
           cron cada minuto con bloqueo de PostgreSQL)
   │  Prisma 7 + adapter-pg
   ▼
PostgreSQL 17 (CHECK constraints, snapshots, historiales append-only, DIVIPOLA)
   +  disco del servidor para fotos (UPLOADS_DIR; volumen de Railway en producción)

Integraciones: solo enlaces wa.me (sin API de WhatsApp), plantillas de rastreo de
transportadoras. Sin correo, SMS, pasarela de pago ni almacenamiento en la nube.
Despliegue previsto: Railway (pendiente: sin Dockerfiles ni CI).
```

### A.3 Hallazgos del análisis estático

Detectados al leer el código; **no se modificó código de producción**. Según `AGENTS.md` §5, se reportan para que la persona usuaria decida.

| ID | Hallazgo | Ubicación | Severidad | Pregunta | Casos |
|---|---|---|---|---|---|
| H-01 | La API pública devuelve `stock` exacto de cada variante y la cotización devuelve `maxQuantity` (que lo deja inferir). La decisión del 2026-10-13 dice que la tienda indica disponible/agotado **sin mostrar la cantidad**; la interfaz cumple, la API no | `products.dto.ts` (`PublicVariantDto.stock`), `products.service.ts` (`toPublicVariantDto`), `orders.service.ts` (`quoteCart`) | Media · **aceptado** (Q-01) | Q-01 | BE-039, BE-118, FE-034 |
| H-02 | Se puede vender a precio final 0: promoción de importe fijo ≥ precio, 100 % sin límite configurado, o `basePrice`/`price` = 0 (permitidos por validación y por la base) | `pricing.service.ts` (`calculateDiscount`), `products.dto.ts` (`@Min(0)`) | Alta · **corregir** (Q-02: no se permite) | Q-02, Q-22 | BE-068, BE-073, BE-102, BE-106 a BE-108, BE-111, BE-143 |
| H-03 | Filtros `status` y `paymentStatus` de `GET /admin/orders` validados con `@IsString` en vez de `@IsEnum`; un valor inválido llega a Prisma (probable 500) | `orders.dto.ts` (`ListOrdersQueryDto`) | Baja | — | BE-145 |
| H-04 | `DELETE /admin/settings/shipping-rates/:id` no usa `ParseUUIDPipe` (probable 500 con id malformado) y responde 200 en vez de 204 | `store-settings.controller.ts` | Baja | — | BE-053 |
| H-05 | La cantidad de un movimiento de inventario no tiene máximo; valores > 2³¹ desbordan la columna `Int` (probable 500) | `inventory.dto.ts` | Baja | — | BE-097 |
| H-06 | Las existencias iniciales verifican "sin movimientos previos" con un conteo no bloqueante; dos solicitudes simultáneas podrían registrar dos `INITIAL` | `inventory.service.ts` (`createMovement`) | Media | — | BE-096 |
| H-07 | El bloqueo por intentos responde 429 solo para correos existentes (permite saber si un correo es del panel) y deja bloquear a la propietaria 15 min con 5 intentos (mitigado por 10/min por IP) | `auth.service.ts` (`login`) | Media | Q-10 | BE-019 |
| H-08 | El costo de envío se puede cambiar en pedidos confirmados, en preparación o despachados, aun con el pago verificado; el total cambia después del pago | `orders.service.ts` (`quoteShipping`) | Media · **aceptado** (Q-03) | Q-03, Q-21 | BE-149 |
| H-09 | Verificar un pago acepta un `amount` distinto del total sin advertencia; una devolución parcial deja el pago como `REFUNDED` (documentado como no definido) | `orders.service.ts` (`verifyPayment`, `refundPayment`) | Media · recomendación por confirmar | Q-04 | BE-170, BE-172 |
| H-10 | Cancelar un pedido con pago verificado no exige ni registra devolución; queda `CANCELLED` + `PAID` | `orders.service.ts` (`cancel`) | Media · **corregir** (Q-05: exigir devolución) | Q-05 | BE-158 |
| H-11 | Cambiar el nombre de un producto regenera su slug: los enlaces compartidos por WhatsApp, redes o buscadores quedan en 404 | `products.service.ts` (`update`) | Baja-Media | Q-07 | BE-069 |
| H-12 | Los estados del producto cambian sin restricciones (de `ARCHIVED` a `ACTIVE`) y se puede publicar sin variantes activas | `products.service.ts` (`changeStatus`) | Baja | Q-08, Q-18 | BE-070, BE-071, FE-037 |
| H-13 | Productos de categorías o marcas inactivas siguen en `GET /store/products` y por slug, aunque el árbol público y el listado de marcas los ocultan | `products.service.ts` (`listPublic`) | Baja | Q-09 | BE-087 |
| H-14 | La búsqueda (`q`) y "Solo ofertas" cargan todos los productos activos y calculan sus precios en memoria; `GET /admin/inventory/variants` no pagina | `products.service.ts`, `inventory.service.ts` | Media (crece con el catálogo) | Q-15 | BE-228, BE-230 |
| H-15 | El limitador de peticiones se apaga con `NODE_ENV=test`, que también usan las pruebas Playwright; en producción depende de `TRUST_PROXY_HOPS` correcto detrás del proxy de Railway | `app.module.ts`, `playwright.config.ts` | Media | — | BE-011, BE-012 |
| H-16 | No hay CI/CD, ni umbral ni medición de cobertura; `docker-compose.yml` (perfil `full`) referencia Dockerfiles que no existen | Repositorio | Alta (proceso) | Q-12 | §E, §F |
| H-17 | El token de seguimiento viaja en la ruta `/store/orders/tracking/:token` y queda en los registros de acceso | `orders.controller.ts`, logs de pino-http | Baja | Q-17 | BE-225 |
| H-18 | El comentario de `ProductsService.list` dice que filtra productos de demostración, pero el filtro está vacío | `products.service.ts` | Baja (coherencia) | — | — |
| H-19 | Los textos legales no están aprobados: las casillas del checkout no enlazan a términos ni a datos personales | `Context/decisiones.md` | Alta (bloquea el lanzamiento) | — | FE-061, E2E-018 |
| H-20 | La transacción que crea el pedido no vuelve a comprobar que la variante siga activa y publicada entre la cotización y la reserva (ventana corta) | `orders.service.ts` (`createOrder`) | Baja | — | BE-136 |
| H-21 | La bolsa no se sincroniza entre pestañas abiertas (los favoritos sí) | `cart-context.tsx` | Baja | Q-11 | FE-054 |

### A.4 Registro de riesgos

Probabilidad e impacto: Alta/Media/Baja. Los riesgos con impacto en ventas, pedidos, pagos, inventario o datos de clientes van primero.

| ID | Riesgo | Área afectada | Prob. | Impacto | Origen | Mitigación (casos) |
|---|---|---|---|---|---|---|
| R-01 | Venta a precio 0 o descuentos no autorizados por configuración errónea de promociones o precios. **Q-02: el precio final 0 no se permite; hoy el código lo permite** | Ventas, pagos | Media | Alto | H-02 | BE-068, BE-073, BE-102, BE-106 a BE-108, BE-111, BE-143 |
| R-02 | Sobreventa de inventario por concurrencia | Inventario, pedidos | Baja | Alto | H-06, H-20 | BE-095, BE-096, BE-128, BE-129, BE-136, BE-098, E2E-012 |
| R-03 | Totales o pagos inconsistentes (monto verificado distinto, cancelación de pedidos pagados sin devolución, total que sube tras el pago) | Pagos, reportes | Media | Alto | H-08, H-09, H-10 | BE-142, BE-149, BE-158, BE-170, BE-172; Q-04, Q-05, Q-21 |
| R-04 | Regresiones no detectadas: no hay CI ni cobertura medida | Todo | Alta | Alto | H-16 | §E fase 2–7, §F; Q-12 |
| R-05 | Configuración de producción incorrecta (`TRUST_PROXY_HOPS`, `INTERNAL_API_KEY`, `PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_URL`, volumen de fotos, secretos) | Seguridad, enlaces de seguimiento, fotos | Media | Alto | H-15 | BE-001, BE-002, BE-006, BE-012, SMK-01, fase 8 |
| R-06 | Lanzamiento con textos legales sin aprobar | Legal (Ley 1581 de 2012, Estatuto del Consumidor) | Alta | Alto | H-19 | FE-061, E2E-018 (bloqueados) |
| R-07 | Pérdida de pedidos o fotos por falta de copias de seguridad | Datos | Baja | Alto | `decisiones.md` (pendiente) | Fase 8 (bloqueado hasta definir la estrategia) |
| R-08 | Exposición de datos que no deben verse (datos del cliente, costos al personal, cantidad en existencia en la interfaz). La cantidad en la API está aceptada (Q-01) | Datos comerciales y personales | Baja | Medio | H-17 | BE-035, BE-038, BE-184, BE-225, FE-034 |
| R-09 | Acceso no autorizado o bloqueo malicioso de la cuenta de la propietaria | Panel | Baja | Alto | H-07 | BE-014 a BE-027, BE-032, BE-033; Q-10 |
| R-10 | Fallos en Safari iOS o problemas de accesibilidad no detectados (solo se prueba Chromium) | Experiencia móvil | Media | Medio | Configuración de Playwright | FE-117 a FE-122; Q-13, Q-20 |
| R-11 | Degradación del catálogo al crecer el número de productos | Tienda | Media | Medio | H-14 | BE-227 a BE-230, FE-123; Q-15 |
| R-12 | Pérdida de la bolsa o favoritos (modo privado, datos corruptos, varias pestañas) | Ventas | Baja | Medio | H-21 | FE-044, FE-045, FE-050, FE-054, FE-132, FE-133 |
| R-13 | Enlaces de productos rotos tras renombrar | Marketing, ventas por WhatsApp | Media | Bajo | H-11 | BE-069; Q-07 |

### A.5 Estado de las funcionalidades

| Funcionalidad (listado inicial y adicionales) | Estado verificado | Evidencia |
|---|---|---|
| Inicio y navegación por categorías | Implementada | `app/(tienda)/page.tsx`, `store-navigation.tsx`, `GET /store/categories` |
| Catálogo y búsqueda | Implementada (búsqueda por nombre, sin tildes ni mayúsculas) | `/productos`, `GET /store/products?q` |
| Filtros por marca y categoría | Implementada | `?marca`, `?categoria` |
| Filtro por precio y ordenamiento elegido | **No implementada; no decidida** | Orden fijo por publicación; ofertas por descuento (FE-027) |
| Detalle y selección de variantes | Implementada | `/producto/[slug]`, `product-detail.tsx` |
| Carrito | Implementada (en el navegador) | `cart-context.tsx`, `POST /store/orders/quote` |
| Checkout y pedidos | Implementada; la presentación del total con envío por confirmar es **provisional** | `checkout-page.tsx`, `POST /store/orders` |
| Autenticación de clientes, registro y recuperación por correo | **No aplicable** (descartado) | `negocio.md` §3, §13; `decisiones.md` |
| Autenticación del panel con roles | Implementada | `auth/*`, `AdminRole` |
| Perfil de cliente e historial | **No aplicable**; sustituido por enlace privado y rastreador | `/seguimiento/[token]`, `/rastrear` |
| Favoritos | Implementada (en el navegador, máx. 100) | `features/favorites/*` |
| Promociones y descuentos | Implementada (variante, producto, categoría; versiones) | `promotions/*` |
| Cupones | **No aplicable** (descartado) | `AGENTS.md` §4 |
| Reseñas y valoraciones públicas | **No aplicable**; existen testimonios registrados por la propietaria | `testimonials/*` |
| Integración con WhatsApp | Implementada como enlaces `wa.me`; **número comercial real pendiente** | `buildWhatsappMessage`, avisos |
| Seguimiento de pedidos | Implementada (enlace privado y código + teléfono) | `orders.controller.ts` |
| Panel: productos, inventario, pedidos, pagos, envíos, usuarios | Implementada | `features/*-manager.tsx` |
| Cancelaciones automáticas, avisos y notificaciones | Implementada; tres comportamientos **pendientes de confirmar** (`plan-desarrollo.md` módulo 11) | `notices/*` |
| Reportes con exportación CSV | Implementada | `reports/*` |
| Contenido, páginas legales, SEO | Construida; **textos legales sin aprobar**; imagen general de vista previa pendiente | `content.dto.ts`, `robots.ts`, `sitemap.ts` |
| Tarifas de envío por municipio y envío gratis | Implementada | `MunicipalShippingRate`, `StoreSettings` |
| Despliegue (módulo 14) | **Pendiente** (sin Dockerfiles, sin CI, sin copias de seguridad) | `docker-compose.yml`, `plan-desarrollo.md` |
| Comportamiento en Railway (proxy, volumen, HTTPS) | **No verificable** hasta desplegar | — |

### A.6 Módulos críticos

1. **Checkout y creación del pedido** (reserva de stock, idempotencia, totales, casillas, WhatsApp).
2. **Motor de precios y promociones** (único punto de cálculo para tienda, bolsa, checkout y edición).
3. **Inventario** (incrementos atómicos, historial que cuadra).
4. **Gestión de pedidos y pagos** (bloqueo optimista, permisos del personal, plazos de 48/24/8 horas).
5. **Autenticación y permisos del panel** (cookie, sesiones, matriz ADMIN/STAFF, costo de compra oculto).
6. **Seguimiento público** (no exponer datos del cliente; mensaje genérico; límite de intentos).

### A.7 Estrategia general

- **Pirámide:** muchas unitarias de lógica pura (precios, formatos, validación), integración/API como capa principal para reglas de negocio con PostgreSQL real, y pocos E2E de flujos completos en celular y escritorio.
- **Reglas en la API, experiencia en la interfaz:** cada regla se prueba una vez en el backend (`BE-xxx`); el frontend verifica que se refleje (`FE-xxx`); los flujos tienda ↔ panel se prueban en `E2E-xxx`.
- **Primero hacer obligatorio lo que ya existe** (CI con las ≈ 265 pruebas actuales: 78 unitarias, ≈ 170 de integración y 18 E2E), luego cerrar huecos P0, luego ampliar a accesibilidad, compatibilidad y rendimiento.
- **Caracterizar antes de corregir:** los hallazgos se fijan con pruebas que documentan el comportamiento actual y se ajustan cuando se responda la pregunta asociada.

---

## B. Matriz de cobertura

Tipos: U = unitarias, I = integración/API, E = E2E, S = seguridad, R = rendimiento. ✔ = cubierto hoy (total o parcial); ○ = planificado en este documento; — = no aplica.

| Módulo | Frontend (rutas y componentes) | Backend (servicio · endpoints) | U | I | E | S | R | Casos FE | Casos BE | Escenarios |
|---|---|---|---|---|---|---|---|---|---|---|
| Plataforma y errores | `error.tsx`, `not-found.tsx`, `next.config.ts` | `app.setup.ts`, `AllExceptionsFilter`, `/health` | ✔ | ✔ | ✔ | ○ | — | FE-006 a FE-008, FE-116 | BE-001 – BE-013 | SMK-01 |
| Acceso al panel | `/admin/login`, `proxy.ts`, `session.server.ts`, `login-form.tsx` | `AuthService`, `SessionService`, `AuthGuard` · `/admin/auth/*` | ✔ | ✔ | ✔ | ✔ | — | FE-086 – FE-094, FE-135, FE-136 | BE-014 – BE-031 | E2E-015, E2E-016, E2E-022 |
| Permisos ADMIN/STAFF | `admin-nav-items.ts`, `requireRole` | `@Roles`, excepciones en `OrdersService` | ✔ | ✔ | ✔ | ○ | — | FE-089, FE-090, FE-098, FE-110, FE-112 | BE-032 – BE-039 | E2E-015 |
| Cuentas del personal | `/admin/cuentas`, `staff-accounts.tsx` | `AdminUsersService` · `/admin/users*` | — | ✔ | ✔ | ✔ | — | FE-097 | BE-040 – BE-046 | E2E-016 |
| Configuración y métodos de pago | `/admin/configuracion`, `settings-forms.tsx`, `payment-methods.tsx` | `StoreSettingsService`, `PaymentMethodsService` · `/admin/settings*`, `/admin/payment-methods*`, `/store/info` | ✔ | ✔ | ✔ | — | — | FE-098 – FE-100 | BE-047 – BE-060 | E2E-017 |
| Ubicaciones DIVIPOLA | Selects del checkout | `/store/locations/*` | — | ✔ | ○ | — | — | FE-058 | BE-061, BE-062 | E2E-001 |
| Contenido, legales y SEO | `/terminos`… `/contacto`, `rich-text.tsx`, `robots.ts`, `sitemap.ts` | `/admin/content`, `/store/content/:slug` | ✔ | ✔ | ✔ | ○ | — | FE-082 – FE-085, FE-101 | BE-055, BE-056 | E2E-018 |
| Catálogo (panel) | `/admin/{productos,marcas,categorias}`, `*-manager.tsx` | `ProductsService`, `BrandsService`, `CategoriesService` · `/admin/products*`, `/admin/brands*`, `/admin/categories*` | ✔ | ✔ | ✔ | ○ | ○ | FE-103 – FE-106 | BE-063 – BE-081, BE-090 | E2E-002, E2E-021 |
| Catálogo (tienda) | `/`, `/productos`, `/producto/[slug]`, `catalog-ui.tsx`, `product-detail.tsx`, `home-sections.tsx` | `GET /store/products*`, `/store/categories`, `/store/brands` | — | ✔ | ✔ | ○ | ○ | FE-001 – FE-039 | BE-082 – BE-089 | E2E-002, E2E-023 |
| Favoritos | `/favoritos`, `favorites-*` | `GET /store/products?ids=` | ○ | ✔ | ✔ | — | — | FE-040 – FE-045, FE-133 | BE-084 | E2E-019 |
| Inventario | `/admin/inventario`, `inventory-manager.tsx` | `InventoryService` · `/admin/inventory/*` | — | ✔ | ✔ | — | ○ | FE-107 | BE-091 – BE-100 | E2E-003 |
| Promociones y precios | `/admin/promociones`, precios en tarjetas y ficha | `PromotionsService`, `PricingService` · `/admin/promotions*` | ✔ | ✔ | ✔ | — | — | FE-025, FE-108 | BE-101 – BE-113 | E2E-004 |
| Bolsa y cotización | `/carrito`, `cart-context.tsx`, `use-cart-quote.ts` | `OrdersService.quoteCart` · `POST /store/orders/quote` | ○ | ✔ | ✔ | ○ | ○ | FE-046 – FE-055, FE-132 | BE-114 – BE-123 | E2E-001, E2E-005 |
| Checkout y pedido | `/checkout`, `/pedido/[code]` | `OrdersService.createOrder` · `POST /store/orders` | ○ | ✔ | ✔ | ○ | ○ | FE-056 – FE-074, FE-134 | BE-124 – BE-143 | E2E-001, E2E-012, E2E-013 |
| Gestión de pedidos | `/admin/pedidos`, `orders-manager.tsx` | `OrdersService` · `/admin/orders*` | — | ✔ | ✔ | ✔ | — | FE-109 – FE-111 | BE-144 – BE-160 | E2E-006, E2E-011 |
| Pagos | `/admin/pagos` | `OrdersService` (pagos) · `/admin/orders/:id/payment*` | ✔ | ✔ | ✔ | ✔ | — | FE-112 | BE-161 – BE-174 | E2E-006 – E2E-008, E2E-020 |
| Envíos | `/admin/envios`, `shipping-manager.tsx` | `ShippingService`, `OrdersService.upsertShipping` · `/admin/carriers*`, `/admin/orders/:id/shipping` | ○ | ✔ | ✔ | ○ | — | FE-113 | BE-175 – BE-183 | E2E-006, E2E-007 |
| Seguimiento y rastreador | `/seguimiento/[token]`, `/rastrear` | `OrdersService.trackPublic/lookupOrder` | ○ | ✔ | ✔ | ✔ | — | FE-075 – FE-081 | BE-184 – BE-190 | E2E-014 |
| Plazos, avisos, notificaciones | `/admin/avisos`, `notifications-bell.tsx` | `NoticesService`, `notice-records.ts`, CLI | ○ | ✔ | ✔ | — | ○ | FE-096, FE-114 | BE-191 – BE-202 | E2E-008 – E2E-010 |
| Reportes y resumen | `/admin/reportes`, `/admin`, `csv.ts` | `ReportsService`, `DashboardService` | ✔ | ✔ | ✔ | ○ | — | FE-095, FE-115, FE-129 | BE-203 – BE-210 | E2E-006, E2E-020 |
| Testimonios | `/admin/testimonios`, sección del inicio | `TestimonialsService` | — | ✔ | ✔ | — | — | FE-015, FE-102 | BE-211 – BE-213 | — |
| Base de datos y scripts | — | Migraciones, `seed.ts`, `prisma/demo`, `test/setup-env.ts` | — | ✔ | — | ○ | — | — | BE-214 – BE-218 | — |
| Transversales de interfaz | Todas las páginas | — | — | — | ○ | — | ○ | FE-009, FE-010, FE-117 – FE-127 | — | — |
| Seguridad (OWASP) | Cabeceras, XSS en la interfaz | Ver `PLAN_PRUEBAS_BACKEND.md` §D.2 | — | ○ | ○ | ○ | — | FE-008, FE-026, FE-069 | BE-219 – BE-226 | — |
| Rendimiento | Lighthouse | Carga sobre API | — | — | — | — | ○ | FE-123 | BE-227 – BE-232 | — |

---

## C. Pruebas de integración end-to-end

Se ejecutan con Playwright en los proyectos `movil` y `escritorio` contra backend y frontend compilados y la base `sky_beauty_test` (ver `frontend/playwright.config.ts`). Los datos se crean desde el panel o la API y son evidentemente ficticios.

| ID | Escenario | Tipo | Precondiciones | Pasos | Datos | Resultado esperado | Casos relacionados | Prioridad | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| E2E-001 | Compra completa sin cuenta en celular: catálogo → detalle → bolsa → checkout → pedido → WhatsApp → seguimiento | E2E | Producto con 2 variantes y stock; Nequi activo; WhatsApp configurado | 1. Buscar el producto. 2. Elegir variante y cantidad. 3. Agregar y abrir la bolsa. 4. Checkout con La Guajira/Riohacha y Nequi; marcar las dos casillas. 5. Confirmar. 6. Abrir el enlace de seguimiento | Cliente "Prueba E2E", tel. `3000000001` | Pedido `PENDING_CONFIRMATION`; stock reservado; botón `wa.me` con el mensaje; seguimiento sin datos del cliente; bolsa vacía | FE-019, FE-029, FE-033, FE-046, FE-056 – FE-066, FE-070, FE-075; BE-114, BE-124, BE-137, BE-184 | P0 | Parcial · existe `e2e/checkout.spec.ts` | Pendiente |
| E2E-002 | Administración → creación de producto → visualización en catálogo | E2E | Sesión ADMIN; marca y categoría con subcategoría | 1. Crear producto con 2 variantes y fotos. 2. Registrar existencias. 3. Publicar. 4. Como cliente, encontrarlo por categoría padre, marca y búsqueda | — | Visible solo después de publicar; galería cambia por variante | FE-017 – FE-019, FE-028, FE-105; BE-063, BE-075, BE-082 | P0 | Sí · existe `e2e/catalog.spec.ts` | Pendiente |
| E2E-003 | Cambio de inventario → actualización de disponibilidad | E2E | Producto publicado con variante en 0 | 1. Ver "Agotado" en la tienda. 2. STAFF registra compra de 3. 3. La tienda muestra "Disponible" y deja agregar. 4. Cliente agrega 2 a la bolsa. 5. STAFF ajusta a 1 con motivo. 6. Cliente abre la bolsa | — | La bolsa marca existencias insuficientes y bloquea el checkout; historial de inventario cuadra | FE-024, FE-030, FE-049, FE-107; BE-091, BE-092, BE-098, BE-115 | P0 | Sí · nueva | Pendiente |
| E2E-004 | Promoción → descuento → compra → pedido inmutable | E2E | Producto de 50.000 en una subcategoría | 1. ADMIN crea promoción del 20 % en la categoría padre. 2. Tienda muestra −20 %, tachado y final. 3. Cliente compra. 4. ADMIN cambia la promoción al 10 %. 5. Revisar el pedido | — | La tienda muestra 10 %; el pedido conserva 20 % y su total | FE-025, FE-108; BE-105, BE-108, BE-109, BE-125 | P0 | Parcial · existe `e2e/promotions.spec.ts` | Pendiente |
| E2E-005 | Reglas de envío en el checkout | E2E | Tarifa de Riohacha 5.000; umbral 100.000 | 1. Checkout en Riohacha con subtotal 50.000. 2. Subir a 100.000. 3. Activar envío gratis nacional y elegir un municipio sin tarifa. 4. Desactivarlo. 5. Crear el pedido y confirmarlo en el panel | — | "Envío: $ 5.000" → "Envío gratis" → gratis → "Envío por confirmar"; confirmar exige registrar el costo | FE-052, FE-068, FE-110; BE-120 – BE-122, BE-147 | P0 | Sí · nueva | Pendiente |
| E2E-006 | Transferencia de punta a punta: pedido → confirmación → comprobante → verificación → despacho → entrega → reporte | E2E | Transferencia activa; transportadora con plantilla | 1. Cliente compra. 2. STAFF confirma con costo de envío. 3. STAFF registra comprobante. 4. ADMIN verifica. 5. STAFF despacha con guía. 6. Cliente ve guía y enlace. 7. STAFF marca entregado. 8. ADMIN ve la venta en reportes del día de verificación | — | Estados y eventos coherentes; venta en `paidAt` | FE-110, FE-112, FE-113, FE-115, FE-075; BE-147, BE-161, BE-176, BE-205, BE-206 | P0 | Parcial · existe en `e2e/payments.spec.ts`, `e2e/shipping.spec.ts`, `e2e/reports.spec.ts` por separado | Pendiente |
| E2E-007 | Contra entrega con entrega local | E2E | COD activo en Riohacha con monto máximo | 1. Cliente compra en Riohacha con COD. 2. STAFF confirma. 3. Envío local en tránsito y entregado. 4. Revisar pago y reporte | — | Pago `PAID` una vez al entregar; seguimiento "Entrega local de la tienda"; venta en reportes | FE-059, FE-078; BE-123, BE-177, BE-181, BE-205 | P0 | Sí · nueva | Pendiente |
| E2E-008 | Pago no demostrado: rechazo → 8 h → aviso → cancelación por el personal | E2E | Pedido confirmado con comprobante | 1. ADMIN rechaza. 2. Avanzar 7 h y correr el ciclo. 3. Enviar el aviso desde la bandeja. 4. Avanzar a 8 h. 5. STAFF cancela con motivo. 6. Cliente abre el seguimiento | — | Aviso "antes" y "después"; existencias liberadas; seguimiento con el aviso | FE-077, FE-112, FE-114; BE-166, BE-194, BE-190 | P0 | Parcial · existe `e2e/payments.spec.ts`, `e2e/notices.spec.ts` | Pendiente |
| E2E-009 | Sin confirmar a las 48 h | E2E | Pedido nuevo | Avanzar 47 h → ciclo; avanzar 48 h → ciclo | — | Aviso previo, cancelación automática, notificación, stock liberado | FE-096, FE-114; BE-191 | P0 | Sí · existe `e2e/notices.spec.ts` | Pendiente |
| E2E-010 | Confirmado sin comprobante a las 24 h | E2E | Pedido confirmado por transferencia | Avanzar `confirmedAt` 24 h y correr el ciclo (requiere ampliar `e2e-advance-order.ts` para mover `confirmedAt`) | — | Cancelado con motivo automático; COD equivalente no se cancela | BE-193 | P1 | Sí · nueva | Pendiente |
| E2E-011 | Edición de pedido sin confirmar por el personal | E2E | Pedido pendiente con 2 líneas | STAFF cambia cantidades y agrega variante; confirma; intenta editar de nuevo | — | Existencias y total recalculados; precio original conservado; no editable tras confirmar | FE-110; BE-151, BE-153, BE-154 | P0 | Sí · existe `e2e/orders.spec.ts` | Pendiente |
| E2E-012 | Última unidad desde dos navegadores | E2E · Concurrencia | Variante con stock 1 | Dos contextos completan el checkout al mismo tiempo | — | Un pedido creado; el otro ve el mensaje de existencias insuficientes y su bolsa marca el problema | FE-063; BE-128 | P0 | Sí · nueva | Pendiente |
| E2E-013 | Reintento por corte de red | E2E · Resiliencia | — | Abortar la respuesta del primer envío; reintentar | — | Un solo pedido en el panel; el cliente llega a su pedido | FE-062, FE-064; BE-130, BE-131 | P0 | Sí · nueva | Pendiente |
| E2E-014 | Rastreo por código y teléfono | E2E | Pedido existente | Rastrear con teléfono escrito de otra forma; con datos erróneos | — | Abre el seguimiento; error genérico | FE-081; BE-187, BE-188 | P1 | Parcial · existe `e2e/tracking.spec.ts` | Pendiente |
| E2E-015 | Permisos del personal de punta a punta | E2E · Seguridad | Cuenta STAFF | Iniciar sesión; revisar menú; abrir URLs de la propietaria; intentar acciones restringidas desde la interfaz | — | Menú reducido; redirección a `/admin`; botones restringidos ausentes | FE-089, FE-090, FE-098, FE-110, FE-112; BE-033, BE-034 | P0 | Parcial · existe `e2e/admin-access.spec.ts` | Pendiente |
| E2E-016 | Ciclo de vida de una cuenta del personal (adaptación de "Registro → Login → Perfil": los clientes no tienen cuenta) | E2E | Sesión ADMIN | ADMIN crea la cuenta → STAFF inicia sesión → cambia su contraseña → ADMIN restablece → ADMIN desactiva | — | Cada paso refleja el cambio; la cuenta desactivada pierde la sesión | FE-093, FE-097; BE-028, BE-041 – BE-043 | P1 | Parcial · existe `e2e/admin-access.spec.ts` | Pendiente |
| E2E-017 | Configuración → tienda | E2E | Sesión ADMIN | Configurar WhatsApp, contacto, redes y municipios de COD | — | Pie y contacto actualizados; COD aparece solo en esos municipios | FE-005, FE-059, FE-099, FE-100; BE-048, BE-059 | P1 | Sí · existe `e2e/store-config.spec.ts` | Pendiente |
| E2E-018 | Textos legales → páginas → pie → casillas del checkout | E2E | Textos aprobados cargados | Publicar los cuatro textos; revisar pie, páginas y enlaces de las casillas | — | Páginas visibles; enlaces de las casillas a `/terminos` y `/datos-personales` | FE-061, FE-082; BE-055 | P1 | Parcial · existe `e2e/content.spec.ts` | Bloqueado (H-19) |
| E2E-019 | Favoritos con producto despublicado | E2E | Dos favoritos | Despublicar uno desde el panel; abrir `/favoritos` | — | Aviso y opción de quitarlo; el otro sigue | FE-042; BE-084 | P2 | Sí · nueva | Pendiente |
| E2E-020 | Devolución y reportes | E2E | Venta verificada | ADMIN registra devolución total | — | La venta sale de los reportes; el seguimiento muestra pago devuelto | FE-112, FE-115; BE-171, BE-205 | P1 | Parcial · existe `e2e/payments.spec.ts` | Pendiente |
| E2E-021 | Producto con pedidos: archivar en lugar de borrar | E2E | Producto con un pedido | ADMIN intenta borrar; archiva; cliente abre el slug; ADMIN abre el pedido | — | Borrado rechazado; tienda 404; el pedido conserva nombre y precio | FE-035, FE-105; BE-072, BE-125 | P1 | Sí · nueva | Pendiente |
| E2E-022 | Cambio de contraseña cierra las demás sesiones | E2E · Seguridad | Mismo usuario en dos navegadores | Cambiar la contraseña en uno; navegar en el otro | — | El segundo vuelve a login | FE-094; BE-028 | P1 | Sí · nueva | Pendiente |
| E2E-023 | Ofertas: franja del inicio → vista de ofertas → agregar desde la tarjeta | E2E | Dos promociones de distinto porcentaje | Abrir la franja; ir a ofertas; usar "+" | — | Orden por mayor descuento; producto de una variante agregado | FE-014, FE-020, FE-038; BE-085 | P1 | Sí · existe `e2e/home.spec.ts` | Pendiente |

---

## D. Priorización

| Prioridad | Definición | Backend | Frontend | E2E | **Total** |
|---|---|---|---|---|---|
| **P0** | Crítico: bloquea la compra o la operación, compromete seguridad, pagos, inventario o integridad | 95 | 31 | 13 | **139** |
| **P1** | Alto: afecta funciones importantes | 88 | 61 | 9 | **158** |
| **P2** | Medio: funciones secundarias | 39 | 40 | 1 | **80** |
| **P3** | Bajo: detalles y mejoras | 10 | 12 | 0 | **22** |
| **Total** | | **232** | **144** | **23** | **399** |

| Estado | Backend | Frontend | E2E | Total |
|---|---|---|---|---|
| Pendiente | 230 | 136 | 22 | 388 |
| Bloqueado | 2 (Q-04, recomendación por confirmar) | 1 (textos legales) | 1 (textos legales) | 4 |
| No aplicable | 0 | 7 | 0 | 7 |

| Automatización | Backend | Frontend | E2E | Total |
|---|---|---|---|---|
| Ya cubierto (`Sí · existe`) | 109 | 22 | 5 | 136 |
| Parcialmente cubierto | 27 | 31 | 9 | 67 |
| Nuevo automatizable | 95 | 82 | 9 | 186 |
| Manual, revisión o no aplicable | 1 | 9 | 0 | 10 |

**Orden de ataque dentro de P0:** primero los que protegen dinero e inventario (BE-106/108/128/129/141/142, E2E-012/013), después permisos y datos expuestos (BE-032/033/038), después la interfaz de compra (FE-056/058/062/064, FE-132/134).

---

## E. Plan de ejecución por fases

| Fase | Objetivo | Qué se ejecuta | Entorno | Duración orientativa |
|---|---|---|---|---|
| **1. Smoke** | Confirmar que la compilación arranca y lo esencial responde | SMK-01 a SMK-12 | Local / CI / cada despliegue | < 5 min |
| **2. Unitarias** | Lógica pura | Backend `npm test`; frontend `npm test` (+ FE-128 a FE-138, BE unitarias nuevas) | CI en cada push | < 2 min |
| **3. Integración** | Reglas de negocio con PostgreSQL | `npm run test:e2e` (backend) + casos BE nuevos | CI en cada push a `dev` | ≈ 5–10 min |
| **4. Funcionales** | Interfaz por módulo (componentes e integración FE) | Casos FE de componentes y `__tests__` | CI en cada push | < 5 min |
| **5. E2E** | Flujos completos en celular y escritorio | `npm run test:e2e` (frontend) con E2E-001 a E2E-023 | CI en push a `dev` y antes de `main` | ≈ 15–25 min |
| **6. Seguridad y rendimiento** | OWASP, accesibilidad, compatibilidad, carga | BE-219 a BE-232, FE-117 a FE-123, `npm audit` | Programado (diario/semanal) y antes de cada lanzamiento | Variable |
| **7. Regresión** | Nada de lo anterior se rompió | Fases 2–5 completas + P0 de la fase 6 | Antes de fusionar a `main` | ≈ 30 min |
| **8. Validación previa a producción** | El entorno real funciona | Lista de la tabla siguiente | Entorno de *staging* (Q-14) o producción antes de abrir al público | 1 sesión |

### E.1 Smoke tests

| ID | Verificación | Referencia |
|---|---|---|
| SMK-01 | `GET /api/v1/health` → 200 con base disponible | BE-003 |
| SMK-02 | `GET /` de la tienda → 200 con encabezado y pie | FE-001 |
| SMK-03 | `GET /productos` lista productos | FE-017 |
| SMK-04 | Ficha de un producto activo carga con precio | FE-028 |
| SMK-05 | Agregar a la bolsa y cotizar (`POST /store/orders/quote` → 200) | FE-033, BE-114 |
| SMK-06 | Departamentos y municipios cargan | BE-061 |
| SMK-07 | `/admin` sin sesión redirige a login | FE-086 |
| SMK-08 | Inicio de sesión de la propietaria y bandeja de pedidos | BE-014, FE-109 |
| SMK-09 | Una foto pública responde en `/uploads/...` desde el dominio de la tienda | BE-079 |
| SMK-10 | Cabeceras de seguridad presentes | FE-008, BE-005 |
| SMK-11 | Swagger no responde en producción | BE-006 |
| SMK-12 | `robots.txt` y `sitemap.xml` responden | FE-084 |

### E.2 Validación previa a producción (fase 8)

| Verificación | Cómo | Estado |
|---|---|---|
| Variables obligatorias definidas (`JWT_SECRET`, `TRACKING_TOKEN_SECRET`, `INTERNAL_API_KEY` iguales en backend y frontend, `PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_URL` antes del build, `CORS_ORIGINS`, `UPLOADS_DIR` en el volumen) | Revisión + arranque (BE-001, BE-002) | Bloqueado (sin entorno) |
| `prisma migrate deploy` limpio y seed ejecutado; cuenta de la propietaria creada y `SEED_OWNER_PASSWORD` retirado | BE-214, BE-216 | Bloqueado |
| `TRUST_PROXY_HOPS` correcto: límites por IP real detrás de Railway | BE-012 con dos conexiones reales | Bloqueado |
| HTTPS y `Strict-Transport-Security`; cookie con `Secure` | FE-008, BE-014 | Bloqueado |
| Las fotos sobreviven a un redespliegue (volumen persistente) | Subir foto → redesplegar → verificar | Bloqueado |
| Copias de seguridad de base y fotos definidas y restauración probada | Pendiente en `decisiones.md` | Bloqueado (R-07) |
| Sin datos de demostración (`isDemo`) ni del prototipo | BE-217, FE-127, consulta SQL | Bloqueado |
| Número comercial de WhatsApp real: la propietaria envía un pedido de prueba desde su celular y lo recibe | Manual | Bloqueado (dato pendiente) |
| Textos legales aprobados cargados y enlazados | E2E-018 | Bloqueado (H-19) |
| Métodos de pago con instrucciones reales y COD con municipios | Revisión con la propietaria | Bloqueado |
| Ciclo de plazos activo en una sola instancia (cron) | Revisar logs "Ciclo de plazos de pedidos" | Bloqueado |
| Pedido de prueba de punta a punta y su cancelación (con datos de prueba evidentes, borrado después) | E2E-001 manual en producción | Bloqueado |

---

## F. Criterios de entrada y salida

### F.1 Por fase

| Fase | Criterio de entrada | Criterio de salida |
|---|---|---|
| 1. Smoke | Compilación de backend y frontend sin errores; migraciones aplicadas | 12/12 SMK aprobados |
| 2. Unitarias | `lint` y `typecheck` sin errores | 100 % aprobadas; cobertura no baja del último valor medido |
| 3. Integración | Base `sky_beauty_test` migrada; fase 2 aprobada | 100 % de P0 y P1 aprobados; invariantes BE-098 y BE-142 sin diferencias |
| 4. Funcionales | Fase 2 aprobada | 100 % de P0 y ≥ 95 % de P1 aprobados |
| 5. E2E | Fases 3 y 4 aprobadas; navegadores instalados | 100 % de P0 en `movil` y `escritorio`; sin pruebas inestables sin registrar |
| 6. Seguridad y rendimiento | Fase 5 aprobada; entorno con datos de volumen | Cero hallazgos críticos/altos abiertos; metas de rendimiento acordadas (Q-15) cumplidas o aceptadas por escrito |
| 7. Regresión | Cambio listo para `main` | Igual que fases 2–5 |
| 8. Pre-producción | Entorno desplegado (Q-14); bloqueos de negocio resueltos | Lista E.2 completa |

### F.2 Condiciones para aprobar un despliegue

1. Fases 1 a 5 y 7 aprobadas en CI sobre el commit a desplegar.
2. Todos los casos **P0** ejecutados y aprobados (backend, frontend y E2E).
3. Ningún defecto abierto de severidad crítica o alta.
4. Q-04 confirmada y Q-22 decidida; los cambios de código que exigen Q-02 y Q-05 implementados y sus casos (BE-102, BE-106 a BE-108, BE-111, BE-143, BE-158) aprobados.
5. Para el **primer lanzamiento** además: lista de la fase 8 completa, incluidos textos legales aprobados (H-19) y copias de seguridad (R-07).

### F.3 Condiciones que bloquean la liberación

- Cualquier P0 fallido o sin ejecutar.
- Diferencias en las invariantes de inventario o de totales (BE-098, BE-142).
- Un pedido que se pueda crear sin existencias, con precio enviado por el cliente o con un método de pago no disponible.
- Una ruta del panel accesible sin sesión o una acción de la propietaria accesible al personal.
- Datos del cliente o costos visibles en rutas públicas.
- Textos legales sin aprobar en el primer lanzamiento.
- Secretos de desarrollo o datos de demostración en producción.

### F.4 Tratamiento de defectos

| Severidad | Definición | Ejemplos en Sky Beauty | Respuesta |
|---|---|---|---|
| Crítica | Pérdida de dinero, inventario o datos; acceso no autorizado; la compra no funciona | Sobreventa, total mal calculado, ruta del panel abierta | Se detiene la liberación; corrección inmediata con prueba de regresión que la reproduzca; nuevo ciclo completo de fases 2–5 |
| Alta | Función importante rota sin alternativa | No se puede confirmar ni despachar; seguimiento roto | Corrección antes de liberar; prueba de regresión |
| Media | Función secundaria rota o con alternativa | Filtro de catálogo, exportación CSV | Se planifica; puede liberarse con aceptación de la propietaria |
| Baja | Estética o texto | Alineación, ortografía | Se agenda |

Cada defecto se registra con: ID del caso que lo detectó, pasos, resultado obtenido vs esperado, evidencia (captura o traza de Playwright) y commit. Todo defecto crítico o alto se cierra con una prueba automatizada que lo cubra.

---

## G. Indicadores de calidad

**Medido** = dato obtenido en esta auditoría. **Meta** = propuesta a validar con la persona usuaria.

| Indicador | Medido (2026-10-15) | Meta propuesta | Cómo se mide |
|---|---|---|---|
| Pruebas unitarias aprobadas | Backend 40/40 · Frontend 38/38 | 100 % | Salida de Jest en CI |
| Pruebas de integración y E2E aprobadas | Sin medir (no ejecutadas) | 100 % | Salida de Jest y Playwright en CI |
| Cobertura automatizada de casos del plan | 136 de 392 aplicables completos (35 %) y 67 parciales | P0: 100 % en 4 semanas; P1: ≥ 80 % en 8 semanas | Casos con prueba que lleva su ID / casos aplicables |
| Cobertura de código | Sin medir | Ver `PLAN_PRUEBAS_BACKEND.md` F.6 y `PLAN_PRUEBAS_FRONTEND.md` E.4 | `jest --coverage` |
| Porcentaje de casos ejecutados por ciclo | 0 % del plan (solo unitarias existentes) | 100 % de P0 y P1 en cada ciclo de regresión | Reporte de CI |
| Porcentaje de aprobación | Sin medir | ≥ 98 % en regresión; 100 % en P0 | Aprobados / ejecutados |
| Defectos por severidad | Sin registro (hallazgos H-xx pendientes de clasificar como defectos) | 0 críticos y 0 altos abiertos al liberar | Registro de defectos |
| Tiempo de ejecución | Unitarias: backend ≈ 14 s, frontend ≈ 36 s | Unitarias < 2 min; integración < 10 min; E2E < 25 min | Tiempos de CI |
| Estabilidad (pruebas inestables) | Sin medir | < 2 % de reintentos; ninguna prueba P0 inestable | Reintentos de Playwright y repeticiones |
| Tiempo medio de corrección de defectos críticos | Sin medir | < 2 días hábiles | Registro de defectos |

---

## H. Preguntas abiertas y dependencias

### H.0 Respuestas recibidas el 2026-10-15

| Pregunta | Respuesta | Consecuencia |
|---|---|---|
| Q-01 | La API **puede seguir enviando** la cantidad en existencia | H-01 aceptado. BE-039 y BE-118 son pruebas de contrato; la interfaz sigue sin mostrar la cantidad (FE-034) |
| Q-02 | **No** se permite precio final 0 | **El código actual no cumple**: acepta precios 0, promociones del 100 % y descuentos fijos mayores que el precio, y el redondeo puede dejar 0. Dos pruebas existentes afirman lo contrario y deben cambiarse junto con el código: `backend/src/modules/promotions/pricing.service.spec.ts` ("un descuento fijo mayor que el precio deja el precio final en 0") y `backend/test/promotions.e2e-spec.ts` ("sin límite configurado solo aplica el tope técnico del 100 %"). Falta decidir el mecanismo (Q-22) |
| Q-03 | **Sí** se puede cambiar el envío después del pago | H-08 aceptado. BE-149 es prueba positiva. Queda Q-21 |
| Q-04 | Se pidió una recomendación | Ver abajo; BE-170 y BE-172 siguen bloqueados hasta confirmarla |
| Q-05 | **Sí**: cancelar un pedido pagado exige la devolución | **El código actual no cumple** (H-10). BE-158 espera que nunca quede `CANCELLED` + `PAID` |

Registradas en `Context/decisiones.md` el 2026-10-15 (Q-04 sigue como recomendación sin confirmar).

**Recomendación para Q-04** (detalle en `PLAN_PRUEBAS_BACKEND.md` §D.3):

1. **Pago menor que el total:** no se marca como pagado; se rechaza como "pago incompleto" y corre el plazo de aclaración de 8 horas que ya existe.
2. **Pago mayor:** se marca pagado por el total con nota obligatoria del excedente a devolver.
3. **Devoluciones:** solo totales por ahora. Las parciales se diseñan cuando se apruebe la política de cambios y devoluciones (hoy en borrador), junto con el reingreso de inventario.
4. **Cancelar un pedido pagado:** primero la devolución total y luego la cancelación (Q-05).

### H.1 Preguntas para la persona usuaria o la propietaria

| ID | Pregunta | Por qué importa | Casos afectados |
|---|---|---|---|
| Q-01 | ✔ **Respondida el 2026-10-15: no.** ¿La API pública debe dejar de enviar la cantidad exacta en existencia (`stock`, `maxQuantity`)? | La decisión del 2026-10-13 dice que no se muestra la cantidad; hoy la API la expone (H-01) | BE-039, BE-118, FE-034 |
| Q-02 | ✔ **Respondida el 2026-10-15: no se permite.** ¿Se permite un precio final de 0 COP (promoción fija ≥ precio, 100 %, precio base 0)? | Riesgo de vender gratis por error (H-02) | BE-106, BE-107, BE-111, BE-143 |
| Q-03 | ✔ **Respondida el 2026-10-15: sí.** ¿Se puede cambiar el costo de envío después de confirmar o de verificar el pago? | Cambia el total después de pagado (H-08) | BE-149 |
| Q-04 | ◐ **Se pidió recomendación** (§H.0); falta confirmarla. ¿Qué pasa si el monto verificado no coincide con el total? ¿Cómo se registran las devoluciones parciales? | Pagos y reportes (H-09) | BE-170, BE-172 |
| Q-05 | ✔ **Respondida el 2026-10-15: sí.** ¿Cancelar un pedido ya pagado debe exigir registrar la devolución? | Dinero recibido sin rastro de devolución (H-10) | BE-158 |
| Q-06 | ¿Se puede registrar el comprobante antes de confirmar el pedido? (pendiente en `plan-desarrollo.md` módulo 8) | Flujo de pagos | BE-165 |
| Q-07 | ¿El slug de un producto debe mantenerse al renombrarlo? | Enlaces compartidos rotos (H-11) | BE-069 |
| Q-08 | ¿Qué cambios de estado del producto se permiten (p. ej. de archivado a activo)? | Coherencia del catálogo (H-12) | BE-070 |
| Q-09 | ¿Los productos de una categoría o marca inactiva deben ocultarse de la tienda? | Visibilidad (H-13) | BE-087 |
| Q-10 | ¿Es aceptable que el bloqueo revele que un correo existe y que permita bloquear a la propietaria 15 min? | Seguridad del panel (H-07) | BE-019 |
| Q-11 | ¿La bolsa debe sincronizarse entre pestañas abiertas, como los favoritos? | Experiencia (H-21) | FE-054 |
| Q-12 | ¿Se puede usar GitHub Actions (plan gratuito) para CI? La regla es no agregar servicios de pago | Sin CI no hay regresión automática (H-16) | §E, §F |
| Q-13 | ¿Se aprueban como dependencias de desarrollo `@axe-core/playwright`, `autocannon` (o k6) y los navegadores Firefox/WebKit de Playwright? | Accesibilidad, carga y compatibilidad | FE-118, FE-121, FE-122, BE-227 – BE-232 |
| Q-14 | ¿Habrá un entorno de *staging* en Railway para validar antes de producción? ¿Entra en el gasto permitido? | Fase 8 | §E.2 |
| Q-15 | ¿Cuántos productos y visitantes simultáneos se esperan? ¿Qué tiempos de respuesta son aceptables? | Metas de rendimiento | BE-227 – BE-232, FE-123 |
| Q-16 | ¿Quién ejecuta las pruebas manuales y quién da la aceptación final (propietaria)? | Responsables de la fase 8 | §E.2 |
| Q-17 | ¿Es aceptable que el token de seguimiento quede en los registros de acceso? | Privacidad (H-17) | BE-225 |
| Q-18 | ¿Se puede publicar un producto sin variantes activas? | Coherencia del catálogo (H-12) | BE-071, FE-037 |
| Q-19 | Un pedido "en preparación" sin comprobante a las 24 h, ¿también se cancela automáticamente? (el código lo hace; la decisión habla de pedidos confirmados) | Cancelaciones automáticas | BE-198 |
| Q-20 | ¿Qué navegadores y versiones mínimas se deben soportar (Safari iOS, Chrome Android)? | Compatibilidad | FE-122 |
| Q-21 | Si el costo de envío sube después de verificado el pago (permitido por Q-03), ¿el pedido sigue como pagado o queda una diferencia por cobrar? | Hoy queda `PAID` con un total mayor al pagado | BE-149 |
| Q-22 | ¿Cómo se impide el precio final 0 (Q-02)? Recomendado: rechazar precios 0 y promociones del 100 %; rechazar al guardar una promoción fija que deje algún destino en 0; no aplicarla si después baja el precio de la variante; redondeo nunca por debajo de 1 COP | Define el resultado exacto de BE-106 y BE-111 | BE-106, BE-111, FE-108 |

Además siguen pendientes, según `plan-desarrollo.md` módulo 11, tres comportamientos aplicados por recomendación (aviso sin saludo en el seguimiento, avisos "antes" vencidos, pago no demostrado cancelado por una persona). Las pruebas BE-190, BE-191 y BE-194 los fijan tal como están; si se confirman distintos, hay que actualizar esos casos.

### H.2 Dependencias y bloqueos

| Dependencia | Bloquea | Responsable |
|---|---|---|
| Textos legales aprobados y validados (H-19) | FE-061, E2E-018, primer lanzamiento | Propietaria + asesoría legal |
| Número comercial de WhatsApp, contacto y redes reales | Validación de fase 8 | Propietaria |
| Instrucciones reales de pago y municipios de COD | Validación de fase 8 | Propietaria |
| Cifras configurables (envío gratis, tope por producto, límite de descuento, umbral de stock bajo) | Pruebas de aceptación con valores reales (las automatizadas usan valores de prueba) | Propietaria |
| Dockerfiles / configuración de Railway y entorno de *staging* | Fase 8, SMK en entorno real | Desarrollo (Q-14) |
| Estrategia de copias de seguridad | R-07, fase 8 | Persona usuaria |
| PostgreSQL local con `sky_beauty_test` | Ejecutar integración y E2E existentes | Desarrollo |
| CI (Q-12) | Regresión automática | Persona usuaria |
| Confirmación de la recomendación de Q-04 y del mecanismo de Q-22 | BE-170, BE-172 y la forma exacta de BE-106/BE-111 | Persona usuaria |
| Cambios de código por Q-02 (precio final 0) y Q-05 (devolución antes de cancelar) | Aprobar BE-068, BE-073, BE-102, BE-106 a BE-108, BE-111, BE-143, BE-158 | Desarrollo |

### H.3 Orden recomendado de implementación

1. **Semana 1 — Hacer obligatorio lo existente:** CI con lint, typecheck, unitarias, integración y E2E existentes (Q-12); medir cobertura; ejecutar y registrar el resultado real de las ≈ 170 pruebas de integración y las 36 ejecuciones E2E.
2. **Semana 1–2 — Huecos P0 de dinero e inventario:** BE-008, BE-098, BE-108, BE-119, BE-121, BE-127, BE-129, BE-141, BE-142; precio final nunca 0 (BE-102, BE-106, BE-107, BE-143) junto con el cambio de código de Q-02; E2E-012 y E2E-013.
3. **Semana 2 — Permisos y exposición de datos:** BE-032, BE-033, BE-038, BE-222; FE-090, FE-091.
4. **Semana 2–3 — Interfaz de compra:** FE-132, FE-134, FE-056, FE-058, FE-062, FE-064, FE-049; E2E-003, E2E-005, E2E-007.
5. **Semana 3 — Pagos y caracterizaciones restantes:** BE-149 (Q-03), BE-158 con el cambio de Q-05, BE-170/BE-172 cuando se confirme Q-04, y los casos que dependen de Q-06 a Q-10.
6. **Semana 4 — Transversales:** accesibilidad (FE-118 a FE-121), responsive (FE-009, FE-010, FE-117), compatibilidad WebKit (FE-122) tras Q-13.
7. **Antes del lanzamiento — Seguridad y rendimiento** (BE-219 a BE-232, FE-123) y **validación previa a producción** (§E.2).
