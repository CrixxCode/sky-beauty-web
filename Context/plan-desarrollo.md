# Plan de desarrollo por módulos

Cada módulo es una **porción vertical**: se construye su backend (API, reglas, pruebas) y su frontend (tienda y/o panel) hasta que funcione de punta a punta. Un módulo no se da por terminado con solo una de las dos partes.

Las reglas de negocio de cada módulo están en [`negocio.md`](negocio.md) y [`decisiones.md`](decisiones.md). Este plan no agrega reglas nuevas; si un módulo necesita una regla que no está definida, se pregunta antes de construirlo (ver [`AGENTS.md`](../AGENTS.md)).

Estado al 2026-10-09: el modelo de datos está completo (`backend/prisma/schema.prisma`). El código de backend y frontend es solo la plantilla inicial.

---

## Cómo se trabaja cada módulo

1. **Rama:** todo el desarrollo se hace en la rama `dev` (decisión de la persona usuaria, 2026-10-09). No se crean ramas por módulo salvo que la persona usuaria lo pida. Cada módulo se cierra con uno o más commits en `dev`.
2. **Orden interno:** backend (endpoints + reglas + pruebas) → frontend (pantallas conectadas a la API) → prueba de punta a punta del flujo principal.
3. **Pruebas:** la lógica de negocio con pruebas unitarias; los endpoints con pruebas de integración contra `sky_beauty_test`; el flujo principal con Playwright cuando haya frontend.
4. **Terminado significa:**
   - cumple el criterio de terminado del módulo;
   - typecheck, lint y pruebas pasan;
   - las preguntas surgidas se resolvieron y quedaron en `decisiones.md`.
5. **Diseño:** cada vista replica el prototipo de referencia (ver `AGENTS.md`, sección 4), con los colores y tipografías oficiales de `decisiones.md`. El logotipo sigue pendiente.

---

## Mapa de módulos

| # | Módulo | Depende de | Necesario para lanzar |
|---|---|---|---|
| 0 | Fundamentos | — | Sí |
| 1 | Acceso y cuentas del panel | 0 | Sí |
| 2 | Configuración de la tienda | 1 | Sí |
| 3 | Catálogo | 1 | Sí |
| 4 | Inventario | 3 | Sí |
| 5 | Promociones y precios | 3 | Sí |
| 6 | Carrito y checkout | 2, 4, 5 | Sí |
| 7 | Gestión de pedidos | 6 | Sí |
| 8 | Pagos | 7 | Sí |
| 9 | Envíos | 7 | Sí |
| 10 | Seguimiento del pedido | 7, 8, 9 | Sí |
| 11 | Cancelaciones automáticas y avisos | 7, 8, 10 | Sí |
| 12 | Contenido y páginas legales | 2 | Sí |
| 13 | Reportes | 7, 8 | No (después del lanzamiento) |
| 14 | Despliegue | todos los anteriores | Sí |

Los módulos 4 y 5 pueden avanzar en paralelo; también 8 y 9, y el 12 en cualquier momento después del 2.

---

## 0. Fundamentos

Base técnica que usan todos los módulos. Es el único módulo que no entrega una funcionalidad visible al cliente.

**Backend**
- Validación de variables de entorno al arrancar (`@nestjs/config` + `zod`).
- Módulo de Prisma con el adaptador de PostgreSQL.
- Logs estructurados (`nestjs-pino`), manejo uniforme de errores, `helmet`, CORS y límite de peticiones (`@nestjs/throttler`).
- Documentación de la API con Swagger y endpoint de salud.
- Configuración de Jest (hoy no ejecuta pruebas) y de la base `sky_beauty_test` con migraciones.
- Script de datos iniciales:
  - la fila de `StoreSettings` con las cifras configurables vacías;
  - los 4 métodos de pago, con contra entrega restringido a municipios (lista vacía);
  - la cuenta de la propietaria, con la contraseña tomada del entorno al ejecutarlo.

**Frontend**
- Tokens de diseño provisionales, tipografía y componentes base.
- Cliente de API, React Query y manejo de errores.
- Estructura de la tienda pública y del panel (`/admin`), con título y metadatos de Sky Beauty en lugar de los de la plantilla.

**Terminado cuando:** el backend arranca validando el entorno, las pruebas se ejecutan contra la base de pruebas, el script de datos iniciales funciona y ambas estructuras (tienda y panel) cargan.

**Estado:** terminado el 2026-10-09.

- Backend: `npm test`, `npm run test:db:prepare`, `npm run test:e2e`, `npm run db:seed`.
- Frontend: `npm test`.

Pendientes que pasan a módulos siguientes:

- **Playwright:** se configura con el primer flujo de punta a punta (módulo 1). Requiere instalar sus navegadores (`npx playwright install`).
- **Imágenes:** la configuración de `next/image` para las imágenes del backend se hace en el módulo 3. En Next.js 16 las IP locales están bloqueadas por defecto.

---

## 1. Acceso y cuentas del panel

**Backend**
- Inicio y cierre de sesión con `AdminSession` (el token solo lleva el id de sesión; revocarla lo invalida).
- Bloqueo temporal tras intentos fallidos (`LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCK_MINUTES`).
- Contraseñas con `argon2`.
- Guardias de permisos por rol (`ADMIN` / `STAFF`), incluidas las excepciones del personal documentadas en `AdminRole`.
- Gestión de cuentas del personal: solo la propietaria crea, desactiva y cambia contraseñas; cada usuario cambia la suya.

**Frontend (panel)**
- Pantalla de inicio de sesión, estructura del panel con menú según el rol, cierre de sesión.
- Gestión de cuentas del personal (solo propietaria) y cambio de contraseña propia.

**Terminado cuando:** la propietaria entra al panel, crea una cuenta de personal, y esa cuenta solo ve y puede usar lo que su rol permite.

**Estado:** terminado el 2026-10-09.

- Pruebas de punta a punta: `npm run test:e2e` en `frontend/`. Compilan backend y frontend en carpetas propias (`dist-e2e`, `.next-e2e`), usan los puertos 4100 y 3100 y la base de pruebas, y se ejecutan en vista de celular y de escritorio.
- Recuperación de la propietaria: `npm run owner:reset-password` en el servidor (ver `src/cli/reset-owner-password.ts`).

---

## 2. Configuración de la tienda

**Backend**
- Lectura y edición de `StoreSettings` (solo propietaria): datos de contacto, WhatsApp, redes, envío gratis, umbral de stock bajo por defecto, límite de descuento porcentual.
- Métodos de pago: activar/desactivar, instrucciones, monto máximo y municipios habilitados (selector DIVIPOLA).
- Endpoint público con los datos visibles de la tienda.
- Endpoint público de departamentos y municipios.

**Frontend**
- Panel: pantallas de configuración y métodos de pago.
- Tienda: encabezado y pie con datos de contacto y redes.

**Terminado cuando:** la propietaria configura el WhatsApp, un método de pago y los municipios de contra entrega, y la tienda muestra los datos de contacto.

**Estado:** terminado el 2026-10-09.

- Panel: `/admin/configuracion` (el personal la ve en solo lectura).
- Tienda: el pie muestra los datos de contacto, las redes y el enlace de WhatsApp configurados.
- Los textos del inicio, la barra de anuncios y los textos legales quedan para el módulo 12.

**Bloqueos de negocio:** número de WhatsApp, redes y datos de contacto reales (se puede construir sin ellos).

---

## 3. Catálogo

El módulo más grande. Se recomienda dividirlo en dos PRs: primero el panel, después la tienda.

**Backend**
- Marcas, categorías de dos niveles (con sus reglas entre filas) y productos con estados `DRAFT` / `ACTIVE` / `INACTIVE` / `ARCHIVED`.
- Variantes: SKU, precio propio, costo (solo propietaria), límite por pedido, color de muestra.
- Historial de precios: una fila en `VariantPriceHistory` en cada cambio del precio efectivo.
- Fotos generales y por variante: carga, miniaturas con `sharp`, almacenamiento en el disco del servidor (`UPLOADS_DIR`; en producción, volumen de Railway). Sin servicios de almacenamiento de pago.
- Archivar en lugar de eliminar productos con historial de pedidos.
- API pública: solo productos `ACTIVE`; filtros por categoría (incluye subcategorías), marca y búsqueda sin distinguir tildes ni mayúsculas; productos agotados visibles.

**Frontend**
- Panel: gestión de marcas, categorías, productos, variantes y fotos.
- Tienda:
  - inicio;
  - listado por categoría y por marca;
  - búsqueda;
  - detalle de producto con selector de variante, galería que cambia según la variante y etiqueta "Agotado".

**Terminado cuando:** la propietaria crea un producto con variantes y fotos, lo publica, y un cliente lo encuentra por categoría, marca y búsqueda desde el celular.

**Bloqueos de negocio:** catálogo real, categorías comerciales y fotos (se puede construir con datos de prueba evidentemente ficticios).

---

## 4. Inventario

**Backend**
- Movimientos: existencias iniciales, entradas por compra y ajustes con motivo obligatorio. Siempre mediante `InventoryMovement`, en transacción.
- Consulta de existencias por variante e historial de movimientos.
- Alertas de stock bajo según el umbral de cada variante.

**Frontend (panel)**
- Existencias por variante, registro de entradas y ajustes, historial y listado de stock bajo.

**Terminado cuando:** se registran entradas y ajustes, el historial cuadra con el stock y aparecen las alertas de stock bajo.

---

## 5. Promociones y precios

La lógica más delicada del sistema: debe tener pruebas exhaustivas antes de conectarla al checkout.

**Backend**
- Gestión de promociones (solo propietaria): porcentaje o valor fijo, alcance variante / producto / categoría, fechas, activación.
- Validación del límite de descuento porcentual de `StoreSettings`.
- `PromotionRevision` en cada creación o cambio.
- Motor de precios, en un único servicio usado por catálogo, carrito, checkout y edición de pedidos:
  - no se acumulan;
  - gana el mayor descuento sin importar el alcance;
  - empate → la creada primero;
  - las de categoría aplican a subcategorías;
  - cálculo "a una fecha" con `VariantPriceHistory` y `PromotionRevision`.

**Frontend**
- Panel: gestión de promociones e historial de versiones.
- Tienda: precio regular, descuento y precio final en listados y detalle.

**Terminado cuando:** las pruebas cubren todos los casos de prioridad y de cálculo a una fecha, y la tienda muestra los precios con descuento correctamente.

---

## 6. Carrito y checkout

**Backend**
- Validación del carrito: existencias, `maxPerOrder`, precios y promociones recalculados en el servidor.
- Disponibilidad de métodos de pago según municipio y total.
- Envío: "por confirmar" o gratis según `freeShippingThreshold`.
- Creación del pedido en una transacción:
  - reserva de existencias;
  - snapshots;
  - cliente por teléfono;
  - código del pedido;
  - token de seguimiento;
  - idempotencia;
  - las dos casillas obligatorias.
- Mensaje de WhatsApp con el resumen del pedido.

**Frontend (tienda)**
- Carrito persistente en el navegador.
- Checkout con datos de entrega, selectores de departamento y municipio (DIVIPOLA), método de pago y las dos casillas.
- Página de pedido creado con el botón para abrir WhatsApp y el enlace de seguimiento.

**Terminado cuando:** un cliente completa una compra desde el celular, las existencias quedan reservadas y WhatsApp se abre con el mensaje correcto.

**Bloqueos de negocio:** los textos de términos y de datos personales deben estar aprobados antes del lanzamiento (no para construir).

---

## 7. Gestión de pedidos

**Backend**
- Listado con filtros y detalle.
- Confirmación, registro del costo de envío cotizado y recálculo del total.
- Cambios de estado con historial.
- Edición de pedidos sin confirmar, con las condiciones del día del pedido y ajuste de existencias.
- Cancelación manual con motivo obligatorio y liberación de existencias, respetando los permisos de cada rol.

**Frontend (panel)**
- Bandeja de pedidos, detalle, confirmación, edición, cotización de envío, cambios de estado e historial.

**Terminado cuando:** el personal confirma un pedido, lo edita antes de confirmarlo y lo cancela solo en los casos permitidos.

---

## 8. Pagos

**Backend**
- Registro del comprobante recibido por WhatsApp (propietaria o personal) → `AWAITING_VERIFICATION`.
- Verificación o rechazo (solo propietaria), con `paymentRejectedAt` para el plazo de aclaración de 8 horas.
- Contra entrega: pagado al marcarse como entregado.
- Devoluciones de dinero (`REFUNDED`) y registro de cada paso en `PaymentRecord`.

**Frontend (panel)**
- Sección de pagos dentro del detalle del pedido y bandeja de pagos por verificar.

**Terminado cuando:** se puede seguir el pago de un pedido desde el comprobante hasta la verificación o el rechazo, con los permisos correctos.

---

## 9. Envíos

**Backend**
- Transportadoras (con plantilla opcional de URL de rastreo).
- Registro del envío: transportadora, guía, costo real, fecha de despacho, estado y entrega.

**Frontend (panel)**
- Gestión de transportadoras y sección de envío en el detalle del pedido.

**Terminado cuando:** un pedido se despacha con transportadora y guía, y se marca como entregado.

---

## 10. Seguimiento del pedido

**Backend**
- Endpoint público por token: estado del pedido, del pago y del envío, sin exponer datos internos (costos, notas internas).

**Frontend (tienda)**
- Página de seguimiento con el estado, la guía con su enlace de rastreo y los avisos de cancelación cuando existan.

**Terminado cuando:** el cliente ve el avance de su pedido con el enlace privado, y un enlace inválido no revela información.

---

## 11. Cancelaciones automáticas y avisos

**Backend**
- Tareas programadas (`@nestjs/schedule`):
  - pedidos sin confirmar a las 48 horas;
  - sin comprobante a las 24 horas de confirmados.
- Detección de pedidos que cumplen 1 hora antes de cada plazo, incluido el de 8 horas de aclaración.
- Registro de los avisos enviados.
  - Puede requerir ampliar el esquema; se decide al construirlo.
- Mensajes aprobados de cada caso.

**Frontend**
- Panel: bandeja de avisos pendientes con el mensaje listo para abrir en WhatsApp y marcar como enviado.
- Tienda: aviso visible en la página de seguimiento.

**Terminado cuando:** los pedidos vencidos se cancelan solos con motivo y liberación de existencias, y el personal ve y envía los avisos antes y después.

---

## 12. Contenido y páginas legales

**Backend**
- Edición de textos del inicio, anuncio y textos legales en `StoreSettings`.

**Frontend**
- Panel: edición de contenidos.
- Tienda: términos, datos personales, cambios y garantías, envíos, contacto. También metadatos para buscadores y vista previa al compartir en redes.

**Terminado cuando:** las páginas legales se publican con los textos aprobados.

**Bloqueos de negocio:**
- **Políticas:** aprobación de las cuatro políticas y validación legal.
- **Marca:** logo y elementos oficiales.

---

## 13. Reportes (después del lanzamiento)

**Backend**
- Ventas por período, productos más vendidos y márgenes con `OrderItem.unitCost` (solo propietaria).

**Frontend (panel)**
- Tablero de reportes.

**Terminado cuando:** la propietaria ve sus ventas y ganancias por período.

**Bloqueos de negocio:** qué reportes concretos necesita (pendiente de preguntar).

---

## 14. Despliegue

- Despliegue en **Railway**: backend, frontend y PostgreSQL. Volumen persistente para las imágenes (`UPLOADS_DIR`), variables de producción, dominio y HTTPS.
- Sin servicios de pago adicionales (ver `decisiones.md`, "Infraestructura sin servicios de pago").

**Bloqueos de negocio:** compra del dominio; estrategia de copias de seguridad de la base de datos y de las imágenes.
