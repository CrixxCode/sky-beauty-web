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
5. **Diseño:** cada vista replica el prototipo de referencia (ver `AGENTS.md`, sección 4), con los colores, tipografías, logotipo e ícono oficiales de `decisiones.md`. El logotipo monocromo sigue pendiente.

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

**Estado:** terminado el 2026-10-13.

- Pruebas: `test/catalog.e2e-spec.ts` (backend) y `e2e/catalog.spec.ts` (Playwright, celular y escritorio).
- Las fotos se sirven desde `UPLOADS_DIR` en `/uploads`; la tienda usa `<img>` en lugar de `next/image`, así que no fue necesario configurarlo.
- Los textos del inicio salen de `StoreSettings.heroTitle` y `heroSubtitle`; sin ellos se muestra solo el nombre de la tienda. Su edición en el panel queda para el módulo 12.
- La tienda indica si una variante está disponible o agotada, sin mostrar la cantidad (ver `decisiones.md`, 2026-10-13).
- Precios con descuento (módulo 5) y botón de agregar al carrito (módulo 6) se agregan en sus módulos.

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

**Estado:** terminado el 2026-10-13.

- Pruebas: `test/inventory.e2e-spec.ts` (backend) y `e2e/inventory.spec.ts` (Playwright, celular y escritorio).
- Panel: `/admin/inventario`, para la propietaria y el personal.
- La justificación es obligatoria en los ajustes y opcional en las entradas (existencias iniciales y compras).
- Las existencias iniciales solo se registran antes de cualquier otro movimiento de la variante.
- El stock se actualiza con un incremento atómico: movimientos simultáneos no se pisan ni dejan existencias negativas.
- Los movimientos de pedidos (reserva, liberación, devolución) no se registran a mano; los crea el módulo de pedidos.

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

**Estado:** terminado el 2026-10-13.

- Motor: `src/modules/promotions/pricing.service.ts`. La elección de la promoción es una función pura (`priceWithPromotions`) con pruebas unitarias de prioridad, empates, alcance, vigencia y límites del precio. Carga las promociones una sola vez por cálculo.
- Pruebas: `pricing.service.spec.ts` (unitarias), `test/promotions.e2e-spec.ts` (integración: gestión, permisos, límite de descuento, versiones, cálculo a una fecha y precios en la tienda) y `e2e/promotions.spec.ts` (Playwright, celular y escritorio).
- Si dos promociones empatan y se crearon en el mismo instante, decide su id para que el resultado sea estable.
- El precio "desde" de un producto y su precio regular tachado salen de la misma variante (la de menor precio final).
- La tienda muestra la etiqueta "−X%", el precio regular tachado y el ahorro, como el prototipo. No muestra el nombre de la promoción.
- Las ediciones simultáneas de una promoción se rechazan con un aviso en lugar de pisarse.
- Bajar el límite del descuento porcentual se rechaza si una promoción activa, vigente o programada lo supera (ver `decisiones.md`, 2026-10-13).

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

**Estado:** terminado el 2026-10-13.

- Pruebas: `test/checkout.e2e-spec.ts` (integración) y `e2e/checkout.spec.ts` (Playwright, celular y escritorio).
- Cotización: no falla por un artículo con problemas; marca cada línea (sin existencias suficientes, sobre el máximo por pedido o ya no disponible) y `canCheckout` bloquea el pedido hasta corregirlo. No expone las existencias exactas.
- Envío según la decisión del 2026-10-13: gratis nacional, gratis por monto mínimo, tarifa del municipio o por confirmar.
- Idempotencia: un reintento con la misma clave devuelve el mismo pedido sin volver a cotizar ni reservar, también si llegan a la vez. El navegador conserva la clave entre reintentos.
- Enlace de seguimiento: token derivado con HMAC y un secreto del servidor (no se puede calcular con los datos del pedido).
- Mensaje de WhatsApp con código, productos, variantes, cantidades, importes, datos de entrega y método de pago, armado con el pedido guardado.
- Carrito en `localStorage`; ya no se borra al recargar.
- Provisional: mientras el envío está por confirmar, el resumen dice "Total sin envío". Sigue pendiente decidir cómo se presenta el total antes y después de conocer el envío (`decisiones.md`).
- Las casillas aún no enlazan a los textos de términos y datos personales: llegan con el módulo 12, cuando estén aprobados.

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

**Estado:** terminado el 2026-10-13.

- Pruebas: `test/orders-admin.e2e-spec.ts`, `test/orders-stock.e2e-spec.ts` (integración) y `e2e/orders.spec.ts` (Playwright, celular y escritorio).
- Confirmar exige tener registrado el costo del envío (ver `decisiones.md`, 2026-10-13).
- Cambios de estado solo hacia adelante: Confirmado → Preparando (opcional) → Despachado → Entregado. Confirmar y cancelar tienen acciones propias.
- Confirmar, cotizar envío, cambiar estado, editar y cancelar usan un bloqueo optimista del pedido: operaciones simultáneas no se pisan (por ejemplo, confirmar y cancelar a la vez).
- Las respuestas al personal nunca incluyen el costo de compra.
- Edición: los productos que ya estaban conservan su precio; los agregados toman el precio y la promoción del día del pedido; el máximo por pedido se valida también al aumentar.
- Al editar, el envío se recalcula con la regla del checkout; sin tarifa se conserva la cotización manual (ver `decisiones.md`, 2026-10-13).

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

**Estado:** terminado el 2026-10-13.

- Pruebas: `test/payments.e2e-spec.ts` (integración) y `e2e/payments.spec.ts` (Playwright, celular y escritorio).
- Panel: sección de pago en el detalle del pedido y bandeja `/admin/pagos` (pagos por verificar).
- El detalle informa el fin del plazo de aclaración y si el personal ya puede cancelar; ambos los calcula el servidor con `ORDER_PAYMENT_CLARIFICATION_HOURS`.
- Si el cliente envía un nuevo comprobante durante la aclaración, el pago vuelve a quedar por verificar y el plazo se anula.
- Registrar, verificar, rechazar y devolver usan bloqueo optimista: verificar y rechazar a la vez, o una devolución con doble clic, se aplican una sola vez.
- La devolución no puede superar lo pagado. Hoy una devolución, aunque sea parcial, deja el pago como devuelto; las devoluciones parciales no están definidas.
- Se puede registrar el comprobante antes de confirmar el pedido; no está definido si debe impedirse.

---

## 9. Envíos

**Backend**
- Transportadoras (con plantilla opcional de URL de rastreo).
- Registro del envío: transportadora, guía, costo real, fecha de despacho, estado y entrega.

**Frontend (panel)**
- Gestión de transportadoras y sección de envío en el detalle del pedido.

**Terminado cuando:** un pedido se despacha con transportadora y guía, y se marca como entregado.

**Estado:** terminado el 2026-10-13.

- Pruebas: `test/shipping.e2e-spec.ts` (integración) y `e2e/shipping.spec.ts` (Playwright, celular y escritorio).
- Panel: `/admin/envios` (transportadoras, para la propietaria y el personal) y sección de envío en el detalle del pedido.
- Cada envío es por transportadora (exige transportadora y guía para despachar) o entrega local (sin transportadora ni guía). Despachar y entregar se registran solo desde el envío; "cambiar estado" solo marca en preparación (ver `decisiones.md`, 2026-10-13). Migración `20261013205358_envio_entrega_local`.
- Avance del envío: sin despachar → en tránsito → (con novedad →) entregado. Un envío entregado no retrocede, pero sus datos se pueden corregir. El pedido solo avanza.
- Una transportadora desactivada no se elige de nuevo, pero los envíos que ya la usan se pueden corregir.
- Registrar el envío usa bloqueo optimista: despachar y cancelar a la vez quedan coherentes.

---

## 10. Seguimiento del pedido

**Backend**
- Endpoint público por token: estado del pedido, del pago y del envío, sin exponer datos internos (costos, notas internas).

**Frontend (tienda)**
- Página de seguimiento con el estado, la guía con su enlace de rastreo y los avisos de cancelación cuando existan.

**Terminado cuando:** el cliente ve el avance de su pedido con el enlace privado, y un enlace inválido no revela información.

**Estado:** terminado el 2026-10-13, salvo los avisos de cancelación, que llegan con el módulo 11.

- Pruebas: `test/order-tracking.e2e-spec.ts` (integración) y `e2e/tracking.spec.ts` (Playwright, celular y escritorio).
- Información mostrada según `decisiones.md` (2026-10-13). No expone datos del cliente ni internos.
- Cualquier enlace inválido (formato incorrecto o inexistente) responde el mismo 404 genérico.
- La página no se indexa en buscadores (`noindex, nofollow`) y el enlace de rastreo se abre sin enviar la dirección de la página (`rel="noreferrer"`).
- Un pedido cancelado muestra el aviso con la fecha, sin los pasos de avance.
- El enlace de seguimiento va en el mensaje de WhatsApp del cliente y en el detalle del pedido del panel (con botón para copiarlo), para reenviarlo si el cliente lo pierde. Lo arma el backend con `PUBLIC_SITE_URL`, que en producción debe ser el dominio de la tienda.
- Rastreador `/rastrear` por código y teléfono (ver `decisiones.md`, 2026-10-13), con límite de 5 intentos por minuto (`test/lookup-throttle.e2e-spec.ts`).
- La vista no existe en el prototipo; usa el mismo lenguaje visual de la tienda.

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

**Estado:** terminado el 2026-10-13.

- Esquema: `CancellationNotice`, `AdminNotification` y `AdminNotificationRead` (migración `20261013222441_avisos_y_notificaciones`).
- Ciclo de plazos cada minuto (`@nestjs/schedule`) con bloqueo de PostgreSQL para que corra una sola instancia. Comando manual: `npm run orders:run-deadlines`.
- Pruebas: `test/notices.e2e-spec.ts` (integración, con la hora controlada) y `e2e/notices.spec.ts` (Playwright, celular y escritorio).
- Panel: bandeja `/admin/avisos` (por enviar y enviados) con contador en el menú, y campana de notificaciones en la cabecera (ver `decisiones.md`, 2026-10-13).
- Tienda: el seguimiento muestra el aviso vigente.
- Aplicado por recomendación, **pendiente de confirmar**:
  - En el seguimiento el aviso se muestra sin el saludo con el nombre del cliente y con la fecha exacta en lugar de "en 1 hora".
  - Un aviso "antes" que nadie envió a tiempo queda como vencido y sale de la bandeja.
  - El pago no demostrado no se cancela solo: después de las 8 horas lo cancela una persona (como dice la decisión), y en ese momento se crea el aviso de cancelación.

---

## 12. Contenido y páginas legales

**Backend**
- Edición de textos del inicio, anuncio y textos legales en `StoreSettings`.

**Frontend**
- Panel: edición de contenidos.
- Tienda: términos, datos personales, cambios y garantías, envíos, contacto. También metadatos para buscadores y vista previa al compartir en redes.

**Terminado cuando:** las páginas legales se publican con los textos aprobados.

**Estado:** construido el 2026-10-13. Falta cargar los textos aprobados (bloqueo de negocio).

- Panel: `/admin/contenido` (la propietaria edita; el personal ve en solo lectura): título y texto del inicio, barra de anuncio, descripción para buscadores y las cuatro páginas legales.
- Tienda: `/terminos`, `/datos-personales`, `/cambios-y-garantias`, `/envios` y `/contacto`. Una página legal sin texto no existe (404) ni aparece en el pie, para no publicar borradores. Las casillas del checkout enlazan a sus textos cuando estén publicados.
- Los textos legales admiten un formato mínimo sin HTML (`#` títulos, `-` listas, `**negrita**`).
- Contacto replica el prototipo con los datos configurados; en lugar del formulario (necesitaría correo) la atención es por WhatsApp.
- Buscadores y redes: descripción y Open Graph desde el panel, vista previa de cada producto con su foto, `robots.txt` (excluye panel, carrito, checkout y páginas privadas) y `sitemap.xml` con productos y páginas publicadas.
- Pruebas: `test/content.e2e-spec.ts` (integración), `rich-text.test.tsx` (unitaria) y `e2e/content.spec.ts` (Playwright, celular y escritorio).
- Pendiente: imagen de vista previa general para redes. Necesita el logotipo en PNG (las redes no aceptan SVG).

**Bloqueos de negocio:**
- **Políticas:** aprobación de las cuatro políticas y validación legal.
- **Marca:** logotipo monocromo y fotografías autorizadas (los logotipos horizontal y vertical y el ícono ya están incorporados).

---

## 13. Reportes (después del lanzamiento)

**Backend**
- Ventas por período, productos más vendidos y márgenes con `OrderItem.unitCost` (solo propietaria).

**Frontend (panel)**
- Tablero de reportes.

**Terminado cuando:** la propietaria ve sus ventas y ganancias por período.

**Estado:** terminado el 2026-10-13.

- Reportes según `decisiones.md` (2026-10-13): venta = pago verificado, sin cancelados ni devueltos, ubicada en la fecha de verificación del pago (`Order.paidAt`, 2026-10-14); ganancia solo de productos; solo la propietaria.
- Backend: `GET /admin/reports/sales` (resumen y serie por día, semana o mes, con los períodos sin ventas), `top-products` y `margins`. Días en hora de Colombia, rango máximo de 3 años.
- Panel: `/admin/reportes` con filtros de fechas (por defecto los últimos 30 días) y pestañas Ventas, Más vendidos y Márgenes. Cada tabla se exporta a CSV (separador `;` y coma decimal, para Excel en español).
- Pruebas: `test/reports.e2e-spec.ts` (integración), `csv.test.ts` (unitaria) y `e2e/reports.spec.ts` (Playwright, celular y escritorio).

---

## 14. Despliegue

- Despliegue en **Railway**: backend, frontend y PostgreSQL. Volumen persistente para las imágenes (`UPLOADS_DIR`), variables de producción (incluida `PUBLIC_SITE_URL` con el dominio de la tienda), dominio y HTTPS.
- **`TRUST_PROXY_HOPS`:** el navegador llega al backend a través del proxy de Railway y de Next.js. Hay que configurar los saltos para que el backend vea la IP real del cliente; si no, los límites de intentos (inicio de sesión, rastreador) se comparten entre todos los clientes.
- Sin servicios de pago adicionales (ver `decisiones.md`, "Infraestructura sin servicios de pago").

**Bloqueos de negocio:** compra del dominio; estrategia de copias de seguridad de la base de datos y de las imágenes.
