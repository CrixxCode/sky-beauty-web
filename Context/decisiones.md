# Decisiones confirmadas

Registro de decisiones de negocio confirmadas después de redactar [`negocio.md`](negocio.md). Cuando una decisión de este archivo difiere de `negocio.md`, prevalece la de este archivo.

Cada decisión cubre solo lo que dice. Lo que no esté escrito aquí sigue pendiente; no se debe extender una decisión a casos que no menciona.

---

## 2026-10-09 — Personal administrativo y permisos

**Decisión:** el panel administrativo no será exclusivo de la propietaria. Habrá personal con acceso además de ella. Esto amplía lo dicho en la sección 13 de `negocio.md` ("administrada por una única propietaria").

Roles:

- **Propietaria (`ADMIN`):** acceso total.
- **Personal (`STAFF`):** puede
  - gestionar pedidos y envíos: ver pedidos, confirmarlos, cambiar su estado, registrar transportadoras y guías;
  - gestionar inventario y catálogo: crear y editar productos, registrar entradas de stock y hacer ajustes.

El personal también puede:

- registrar en el sistema que llegó el comprobante de pago enviado por WhatsApp;
- cancelar un pedido **solo** cuando el pago no se pudo demostrar después de darle al cliente la oportunidad de aclararlo, indicando el motivo (ver "Cancelación automática de pedidos confirmados sin pago").

El personal también puede:

- editar pedidos sin confirmar (ver "Edición de pedidos sin confirmar");
- dar por pagado un pedido contra entrega al marcarlo como entregado (ver "Pago contra entrega: pagado al entregarse").

**Exclusivo de la propietaria:**

- verificar o rechazar pagos (salvo el caso de contra entrega descrito arriba);
- crear y editar promociones;
- cancelar pedidos en cualquier otro caso;
- ver y editar costos de compra;
- la configuración comercial de la tienda;
- crear, desactivar y cambiar la contraseña de las cuentas del personal. El personal solo puede cambiar su propia contraseña.

---

## 2026-10-09 — Descuento de existencias al crear el pedido

**Decisión:** las existencias de cada variante se descuentan (reservan) en el momento en que el cliente crea el pedido al terminar el checkout. Si no hay existencias suficientes, el pedido no se puede crear.

---

## 2026-10-09 — Cancelación automática de pedidos sin confirmar

**Decisión:** un pedido que siga sin confirmar 48 horas después de creado se cancela automáticamente y sus existencias se liberan.

**Pendiente:** si el cliente debe recibir algún aviso antes o después de la cancelación.

---

## 2026-10-09 — Cancelación automática de pedidos confirmados sin pago

**Decisión:** para validar un pago por transferencia bancaria, Nequi o Daviplata, el cliente debe enviar el comprobante de pago.

- Si 24 horas después de que la tienda confirma el pedido el cliente no ha enviado el comprobante, el pedido se cancela automáticamente y sus existencias se liberan.
- Si el cliente envió el comprobante, el pedido **no** se cancela por plazo. Solo se cancela si la tienda lo verifica y no hay evidencia del pago.

No aplica al pago contra entrega, que se paga al recibir el pedido.

**Comprobante:** el cliente lo envía por WhatsApp. La propietaria o el personal registra en el sistema que llegó.

**Pago no demostrado:** si al verificar no hay evidencia del pago, el cliente tiene **8 horas** para aclararlo, contadas desde que la tienda marca el pago como rechazado. Si en ese plazo no logra demostrarlo, la propietaria o el personal puede cancelar el pedido indicando el motivo. Antes de que se cumplan las 8 horas no se puede cancelar por este motivo.

**Avisos al cliente:** ver la decisión "Avisos de cancelación".

---

## 2026-10-09 — Prioridad entre promociones (actualizada)

**Decisión:** las promociones pueden aplicar a una variante específica, a un producto completo o a una categoría. No se acumulan; a cada artículo se le aplica una sola:

1. Gana la que da mayor descuento al cliente, sin importar si es de variante, producto o categoría.
2. Si hay empate, gana la creada primero.

Esta decisión reemplaza a la anterior, en la que la promoción del producto prevalecía sobre la de la categoría.

Una promoción de una categoría aplica también a los productos de sus subcategorías.

Una promoción se puede modificar en cualquier momento, incluso después de que empezó (descuento, fechas, productos incluidos). El sistema guarda cada versión para saber qué condiciones tenía en una fecha dada.

---

## 2026-10-09 — Límite de descuento porcentual configurable

**Decisión:** el descuento porcentual máximo de una promoción es configurable desde el panel. La propietaria quiere un límite más bajo que el 90 % que hoy tiene el esquema.

**Pendiente:** el valor inicial del límite.

---

## 2026-10-09 — Costo de envío cotizado por WhatsApp

**Decisión:** el checkout no calcula el costo de envío. El cliente ve "Envío por confirmar" y la tienda le informa el valor por WhatsApp. El costo se registra después en el pedido y el total final se ajusta.

**Envío gratis:** si el pedido alcanza un monto de compra mínimo, configurable desde el panel, el envío es gratis y el checkout lo muestra así en lugar de "Envío por confirmar".

El monto mínimo se compara con el subtotal **después** de aplicar descuentos.

**Pendiente:**

- El monto mínimo para envío gratis.
- Cómo se presenta al cliente el total antes y después de conocer el envío.

---

## 2026-10-13 — Tarifas de envío por municipio y envío gratis nacional

**Decisión:** el checkout puede calcular automáticamente el costo de envío cuando el municipio del cliente tiene una tarifa configurada en el panel. Si el municipio no tiene tarifa configurada, el envío queda como "Envío por confirmar" y la tienda lo informa por WhatsApp.

La tienda está ubicada en Riohacha. Riohacha debe quedar configurada con una tarifa local de **5.000 COP** para todos los envíos dentro de ese municipio, modificable desde el panel.

Además existen dos formas de envío gratis:

1. **Envío gratis por monto mínimo:** regla permanente configurable desde el panel. Se compara contra el subtotal después de descuentos.
2. **Envío gratis nacional por interruptor:** regla temporal configurable por la propietaria desde el panel, pensada para campañas como "envío gratis todo el fin de semana".

Prioridad de cálculo en checkout:

1. Si el envío gratis nacional está activo, el envío cuesta 0 COP para cualquier municipio.
2. Si no está activo y el pedido alcanza el monto mínimo de envío gratis, el envío cuesta 0 COP.
3. Si no aplica envío gratis y el municipio tiene tarifa configurada, se cobra esa tarifa.
4. Si no aplica ninguna de las anteriores, el envío queda por confirmar.

---

## 2026-10-13 — Entrega por transportadora o entrega local

**Decisión:** cada envío es **por transportadora** o **entrega local** de la tienda (por ejemplo, con mensajero propio).

- Por transportadora: para despachar se registran transportadora y número de guía.
- Entrega local: no lleva transportadora ni guía. El seguimiento del cliente la muestra como "Entrega local de la tienda".
- La entrega local no se limita a ningún municipio en el sistema; la elige el personal.
- El despacho y la entrega se registran solo desde el envío del pedido. "Cambiar estado" solo marca el pedido en preparación.

---

## 2026-10-13 — Confirmar un pedido exige el costo del envío

**Decisión:** un pedido solo se puede confirmar cuando tiene registrado el costo del envío (calculado en el checkout o cotizado por la tienda). Así el cliente conoce el total que debe pagar antes de que empiece el plazo de 24 horas para enviar el comprobante.

---

## 2026-10-13 — Envío recalculado al editar un pedido sin confirmar

**Decisión:** al editar un pedido sin confirmar, el costo del envío se recalcula con la misma prioridad del checkout (envío gratis nacional, envío gratis por monto mínimo sobre el subtotal editado, tarifa del municipio) y con la configuración vigente al editar.

- Si ninguna regla da un valor y la tienda ya había cotizado el envío a mano, se conserva esa cotización.
- Si el envío era gratis y deja de serlo, y el municipio no tiene tarifa, vuelve a quedar por confirmar.
- Cada recálculo que cambia el envío queda en el historial del pedido.

---

## 2026-10-13 — Bajar el límite del descuento porcentual

**Decisión:** no se puede bajar el límite del descuento porcentual mientras haya promociones porcentuales activas, vigentes o programadas, cuyo descuento lo supere. El sistema no guarda el cambio y muestra cuáles son, para que la propietaria las edite o desactive primero.

- Las promociones vencidas o inactivas no bloquean el cambio. Si después se reactivan o editan, se validan contra el límite vigente.
- Quitar el límite siempre se permite.
- El sistema nunca recorta ni desactiva promociones por su cuenta.

---

## 2026-10-13 — Existencias iniciales una sola vez por variante

**Decisión:** las existencias iniciales de una variante solo se registran antes de cualquier otro movimiento de esa variante. Después, las entradas se registran como compras y las correcciones como ajustes, con su justificación obligatoria.

---

## 2026-10-13 — Disponibilidad de variantes en la tienda

**Decisión:** la tienda indica si una variante está disponible o agotada, sin mostrar al cliente la cantidad de unidades en existencia.

---

## 2026-10-09 — Pago contra entrega solo en algunas ciudades

**Decisión:** el pago contra entrega solo se ofrece en los municipios que configure la propietaria y para pedidos que no superen un monto máximo, también configurable. Si no se cumple alguna de las dos condiciones, no aparece como opción en el checkout.

**Pendiente:** el listado de municipios y el valor del monto máximo.

---

## 2026-10-09 — Umbral de stock bajo por variante

**Decisión:** cada variante tiene su propio umbral de stock bajo. Al crear una variante se propone un valor por defecto, configurable desde el panel, que se puede cambiar para esa variante.

**Pendiente:** el valor por defecto.

---

## 2026-10-09 — Seguimiento del pedido con enlace privado

**Decisión:** al terminar el checkout, el cliente recibe un enlace privado, sin necesidad de cuenta, donde puede consultar el estado de su pedido y de su envío.

**Pendiente:** qué información exacta se muestra en esa página.

---

## 2026-10-09 — Departamentos y municipios oficiales del DANE

**Decisión:** los departamentos y municipios que elige el cliente en el checkout, y los que se configuran para el contra entrega, salen de la lista oficial del DANE (DIVIPOLA). No se escriben a mano.

---

## 2026-10-09 — Avisos de cancelación

**Decisión:** el cliente recibe un aviso **antes** y otro **después** de que se cancele su pedido, en los tres casos:

1. Pedido sin confirmar a las 48 horas.
2. Pedido confirmado sin comprobante de pago a las 24 horas.
3. Pago no demostrado después de las 8 horas de aclaración.

- **Anticipación del aviso previo:** 1 hora antes del vencimiento del plazo.
- **Canales:** ambos a la vez. El personal o la propietaria lo envía por WhatsApp de forma manual, y además aparece en la página de seguimiento del pedido.
- **Mensajes:** cada caso tiene sus propios mensajes. Mensaje de referencia dado por la persona usuaria para el caso 3: "Tu pedido se cancelará. Motivo: pago no verificado, ponte en contacto con el personal."

**Mensajes aprobados** por la persona usuaria el 2026-10-09. `{nombre}` y `{código}` son el nombre del cliente y el código del pedido.

| Caso | Antes (1 hora) | Después |
|---|---|---|
| 1. Sin confirmar | Hola, {nombre}. Tu pedido {código} se cancelará en 1 hora. Motivo: no hemos recibido la confirmación de tu pedido por WhatsApp. Si aún lo quieres, escríbenos por este chat. | Hola, {nombre}. Tu pedido {código} fue cancelado. Motivo: no recibimos la confirmación de tu pedido por WhatsApp. Si aún quieres los productos, puedes hacer un nuevo pedido en la tienda. |
| 2. Sin comprobante | Hola, {nombre}. Tu pedido {código} se cancelará en 1 hora. Motivo: no hemos recibido el comprobante de pago. Envíanoslo por este chat para conservar tu pedido. | Hola, {nombre}. Tu pedido {código} fue cancelado. Motivo: no recibimos el comprobante de pago. Si ya pagaste, ponte en contacto con el personal. |
| 3. Pago no demostrado | Hola, {nombre}. Tu pedido {código} se cancelará en 1 hora. Motivo: pago no verificado, ponte en contacto con el personal. | Hola, {nombre}. Tu pedido {código} fue cancelado. Motivo: pago no verificado. Si tienes alguna duda, ponte en contacto con el personal. |

---

## 2026-10-09 — Cifras configurables sin valor inicial

**Decisión:** el monto mínimo para envío gratis, el umbral de stock bajo por defecto, el límite del descuento porcentual, los municipios con contra entrega y el monto máximo de contra entrega se configuran desde el panel. No tienen valor inicial: los define la propietaria.

Mientras no se configuren:

- No hay envío gratis.
- Las variantes nuevas no proponen umbral de stock bajo.
- El descuento porcentual solo está limitado por el tope técnico del 100 %.
- El contra entrega no se ofrece en ningún municipio.
- El contra entrega no tiene monto máximo.

---

## 2026-10-09 — Políticas y términos para clientes

**Decisión:** la persona usuaria pidió que un agente redactara los textos legales. Los borradores están en:

- [`politicas/terminos-condiciones.md`](politicas/terminos-condiciones.md)
- [`politicas/cambios-devoluciones-garantias.md`](politicas/cambios-devoluciones-garantias.md)
- [`politicas/tratamiento-datos-personales.md`](politicas/tratamiento-datos-personales.md)
- [`politicas/envios.md`](politicas/envios.md)

**Pendiente:**

- Revisión y aprobación de la propietaria, y validación con asesoría legal. Hasta entonces son **borradores**: no se deben tratar como políticas vigentes ni publicar.
- Completar los datos marcados `[PENDIENTE: ...]`: responsable, identificación, contacto, fechas, si los precios incluyen IVA, cobertura y tiempos de envío.
- Confirmar lo que propuso el agente:
  - En cambios: reporte en 48 horas, cambios en 5 días hábiles y reembolso en 15 días hábiles.
  - En términos: exigir mayoría de edad.
  - En envíos: el cliente paga un nuevo envío si la entrega falla por datos incorrectos o porque nadie recibe.

---

## 2026-10-09 — Formato de nombres de departamentos y municipios

**Decisión:** los nombres se muestran con mayúscula inicial en cada palabra, con los conectores (de, del, la, las, los, el, y, e) en minúscula salvo al inicio, y con las siglas intactas. Ejemplos: "San José del Guaviare", "Valle del Cauca", "Bogotá, D.C.", "La Ceja".

---

## 2026-10-09 — Dos casillas separadas en el checkout

**Decisión:** el checkout tiene dos casillas obligatorias y separadas:

1. Aceptación de los términos y condiciones.
2. Autorización del tratamiento de datos personales, conforme a la Ley 1581 de 2012.

El pedido registra por separado el momento en que se marcó cada una.

**Pendiente:** el texto de los términos y condiciones (`StoreSettings.termsText`) no se ha redactado.

---

## 2026-10-09 — Estructura del catálogo

**Decisiones:**

- **Variantes:** cada producto varía en una sola dimensión (tono, color, tamaño o presentación). Si aparece un caso con dos dimensiones, se revisará.
- **Fotos:** hay fotos generales del producto y, además, fotos propias de cada variante (por ejemplo, el swatch de un tono). Al elegir la variante, la galería muestra sus fotos.
- **Contenido neto:** es un dato del producto, común a todas sus variantes.
- **Categorías:** dos niveles, categoría y subcategoría. Un producto puede ir en una subcategoría o directamente en una categoría que no tenga subcategorías.
- **Marcas:** se venden varias marcas y el cliente puede filtrar el catálogo por marca.
- **Agotados:** si todas las variantes de un producto están agotadas, el producto sigue visible con la etiqueta "Agotado" y no se puede agregar al carrito.
- **Límite por pedido:** la propietaria puede fijar un máximo de unidades por pedido en variantes específicas. Se cuenta por variante. Sin límite configurado, el cliente puede pedir todas las unidades disponibles.
- **Costo de compra:** cada variante guarda su costo de compra para calcular márgenes y ganancias. El pedido guarda el costo del momento de la venta. Solo la propietaria lo ve.

- **Marca obligatoria:** todo producto debe tener marca.

**Pendiente:**

- Qué otra información de producto se necesitará más adelante (por ahora solo se confirmó el contenido neto; no se incluyen modo de uso, ingredientes ni notificación sanitaria INVIMA).

---

## 2026-10-09 — Edición de pedidos sin confirmar

**Decisión:** mientras un pedido está sin confirmar, la propietaria o el personal puede modificarlo: cambiar variantes, cantidades, agregar o quitar productos. Las existencias y el total se recalculan.

Al editar se respetan las condiciones del día en que el cliente hizo el pedido:

- Los productos que ya estaban conservan su precio, promoción y descuento originales.
- Los productos que se agregan o cambian (por ejemplo, otro tono) toman el precio y las promociones que estaban vigentes cuando se hizo el pedido, aunque después hayan cambiado o vencido.

Esta regla corrige una versión anterior en la que los productos agregados o cambiados tomaban las condiciones vigentes al editar.

Una vez confirmado, el pedido no se puede editar.

---

## 2026-10-09 — Pago contra entrega: pagado al entregarse

**Decisión:** en un pedido contra entrega, cuando la propietaria o el personal lo marca como entregado, el pago queda registrado como recibido. Es una excepción a la regla de que solo la propietaria verifica pagos.

---

## 2026-10-09 — Facturación electrónica

**Decisión:** por ahora la tienda no emite factura electrónica. El checkout no pide documento de identidad ni correo.

---

## 2026-10-09 — Configuración de la tienda y métodos de pago

**Decisiones:**

- **Instrucciones obligatorias para activar pagos verificables:** transferencia bancaria, Nequi y Daviplata no se pueden activar sin instrucciones de pago, y no se pueden borrar sus instrucciones mientras estén activos. El efectivo contra entrega no requiere instrucciones.
- **El personal ve la configuración sin editarla:** la sección de configuración es visible para el personal en modo solo lectura; solo la propietaria la modifica.
- **Número de WhatsApp:** se guarda con el código de país y sin `+` (por ejemplo, `573001234567`). Si se escribe un celular colombiano de 10 dígitos sin código de país, se le agrega `57` automáticamente; también se acepta escrito con `57` o `+57`.

---

## 2026-10-09 — Identidad visual y prototipo de referencia

**Decisiones:**

- **Colores oficiales:** `#B785B8`, `#A46EA4`, `#D8D4CB`, `#F5F1EB`, `#8A694D`.
- **Tipografías oficiales:** Playfair Display (títulos) y Poppins (textos).
- **Prototipo de referencia:** `C:\Users\Usuario\Downloads\Sky_Beauty_React_Demo\sky-beauty-demo`. Toda vista del frontend (tienda y panel) debe verse tal cual el prototipo (ver `AGENTS.md`, sección 4).
- **Alcance del prototipo:** se copia solo el diseño. La funcionalidad sigue `negocio.md` y este archivo; las funciones del prototipo que el contexto descarta o no menciona (cuentas y registro de clientes, favoritos, cupones, recuperación por correo, testimonios) no se construyen sin consultarlo.

**Pendiente:** el logotipo monocromo y las fotografías autorizadas. Los logotipos horizontal y vertical y el ícono ya se incorporaron (ver la entrada del 2026-10-13).

---

## 2026-10-09 — Recuperación de contraseñas sin correo

**Decisión:** como no hay servicio de correo, no existe "¿Olvidaste tu contraseña?" por email.

- Si alguien del personal olvida su contraseña, la propietaria se la restablece desde el panel.
- Si la propietaria olvida la suya, se restablece con un comando que se ejecuta en el servidor (por ejemplo, desde la consola de Railway). Al restablecerla se cierran sus sesiones abiertas y se quita cualquier bloqueo por intentos fallidos.

---

## 2026-10-09 — Infraestructura sin servicios de pago

**Decisión:** el proyecto no cuenta con recursos para servicios de pago. Los únicos gastos permitidos son:

- el despliegue en **Railway** (aplicaciones y base de datos);
- el **dominio**.

No se usan S3 ni otros almacenamientos en la nube, CDN, servicios de correo o SMS, ni APIs de pago de WhatsApp. Las imágenes de los productos se guardan en el disco del servidor (en producción, un volumen persistente de Railway). Cualquier funcionalidad que requiera otro servicio de pago debe consultarse antes.

**Pendiente:**

- Confirmar que el volumen persistente de Railway para las imágenes entra dentro del gasto de Railway permitido.
- Cómo se harán las copias de seguridad de la base de datos y de las imágenes.

---

## 2026-10-13 — Logotipo e ícono oficiales

**Decisión:** se incorporan los archivos oficiales de marca, ubicados en `frontend/public/brand/`:

- `horizontal_logo.svg`: logotipo horizontal. Reemplaza el espacio reservado del encabezado de la tienda.
- `vertical_logo.svg`: logotipo vertical. Se usa en el menú lateral del panel administrativo y en la pantalla de inicio de sesión del panel.
- `favicon.svg`: ícono del sitio.

**Pendiente:** el logotipo monocromo y las fotografías autorizadas.

---

## Cómo se reflejan estas decisiones en el código

Estado al 2026-10-13. Migraciones en `backend/prisma/migrations/`:

- `20261009215727_decisiones_negocio`
- `20261009220515_divipola_y_cancelaciones`
- `20261009220900_plazo_aclaracion_pago`
- `20261009221243_datos_divipola`
- `20261009221800_autorizacion_datos_personales`
- `20261009222634_nombres_divipola_legibles`
- `20261009223847_catalogo_y_edicion_pedidos`
- `20261009224247_historial_precios_y_promociones`
- `20261013000000_tarifas_envio_municipio`

### Ya reflejado

- **Envío por confirmar:** `Order.shippingCost` es `null` mientras el envío no se ha cotizado y `0` cuando es gratis. `Order.total` no incluye el envío hasta que se cotiza. Se eliminó la tarifa plana (`StoreSettings.shippingFlatRate`).
- **Envío gratis:** `StoreSettings.freeShippingThreshold` (subtotal después de descuentos; `null` = nunca).
- **Envío gratis nacional:** `StoreSettings.nationalFreeShipping` activa envío gratis a cualquier municipio mientras esté encendido.
- **Tarifas de envío por municipio:** `MunicipalShippingRate` guarda tarifas configuradas por código DIVIPOLA. La migración `20261013000000_tarifas_envio_municipio` deja Riohacha (`44001`) con 5.000 COP como tarifa inicial. Si un municipio no tiene tarifa y no aplica envío gratis, `Order.shippingCost` queda `null`.
- **Contra entrega:** `PaymentMethod.restrictToCities` + `PaymentMethodCity` (código DIVIPOLA del municipio) y `PaymentMethod.maxOrderTotal`.
- **DIVIPOLA:** tablas `Department` (código de 2 dígitos) y `Municipality` (código de 5 dígitos). `Order.municipalityCode` guarda el municipio de entrega; `Order.department` y `Order.city` conservan los nombres del momento del pedido.
- **Datos DIVIPOLA:** 33 departamentos y 1.122 entradas (1.103 municipios, 18 áreas no municipalizadas y 1 isla). Fuente: datos.gov.co, conjunto "DIVIPOLA- Códigos municipios" (`gdxc-w37w`) del DANE, actualizado el 2025-01-24. El DANE publica los nombres en mayúsculas; se guardan ya formateados según la decisión de formato. Para actualizarlos, se crea una nueva migración que respete ese formato.
- **Comprobante de pago:** al registrar que llegó, el pedido pasa a `paymentStatus = AWAITING_VERIFICATION` y queda un `PaymentRecord` con quién lo registró. `REJECTED` = sin evidencia del pago, pendiente de aclaración.
- **Plazos:** variables de entorno `ORDER_PENDING_TTL_HOURS=48`, `ORDER_UNPAID_TTL_HOURS=24` y `ORDER_PAYMENT_CLARIFICATION_HOURS=8`.
  - El de 24 horas se cuenta desde `Order.confirmedAt` y solo aplica a pedidos con `paymentStatus = PENDING` (sin comprobante); un pedido en `AWAITING_VERIFICATION` no se cancela por plazo.
  - El de 8 horas se cuenta desde `Order.paymentRejectedAt`.
- **Cancelaciones:** la base de datos exige `Order.cancelReason` en todo pedido cancelado, incluidas las cancelaciones automáticas.
- **Stock bajo:** `ProductVariant.lowStockThreshold` ya no tiene valor fijo; se propone desde `StoreSettings.defaultLowStockThreshold`. `null` = sin alerta.
- **Descuento máximo:** `StoreSettings.maxPercentageDiscount`, validado por la aplicación. La base de datos solo impide superar el 100 %.
- **Autorización de datos:** `Order.termsAcceptedAt` (casilla 1) y `Order.dataProcessingConsentAt` (casilla 2).
- **Catálogo:** `Brand` (y `Product.brandId`, obligatorio), `Category.parentId` (subcategorías), `Product.netContent`, `ProductImage.variantId` (fotos por variante; `null` = foto general), `ProductVariant.costPrice` y `ProductVariant.maxPerOrder`.
- **Promociones por variante:** `PromotionScope.VARIANT` y la tabla `PromotionVariant`.
- **Edición de pedidos:** evento `OrderEventType.ITEMS_CHANGED`; las existencias se ajustan con movimientos `ORDER_RESERVED` y `ORDER_RELEASED`. Los productos que ya estaban conservan su snapshot en `OrderItem`.
- **Condiciones a una fecha:** `VariantPriceHistory` guarda cada cambio del precio efectivo de una variante y `PromotionRevision` guarda cada versión de una promoción (condiciones y destinos). Con ambas se calcula el precio y la promoción vigentes en `Order.createdAt` para los productos agregados o cambiados al editar.
- **Costo en el pedido:** `OrderItem.unitCost`.
- **Permisos:** documentados en `AdminRole`.

### Pendiente en el código

- El proceso que ejecuta las cancelaciones automáticas.
- **Avisos de cancelación:** registrar qué avisos se enviaron por WhatsApp, mostrarle al personal qué pedidos necesitan aviso y mostrar el aviso en la página de seguimiento.
- **Permisos:** aplicarlos en el backend al implementar el panel, incluidas las excepciones del personal (cancelación por pago no demostrado y pago contra entrega al entregarse) y la restricción de costos.
- **Historiales:** la aplicación debe escribir una fila en `VariantPriceHistory` cada vez que cambie el precio efectivo de una variante (incluida su creación y los cambios de `Product.basePrice`), y una `PromotionRevision` al crear o modificar una promoción.
- **Limitación conocida:** la pertenencia de un producto a una categoría y la estructura de subcategorías no tienen historial. Si un producto cambia de categoría, al editar un pedido anterior las promociones de categoría se evalúan con su categoría actual.
- **Reglas entre filas que valida la aplicación:** máximo dos niveles de categorías; un producto no puede ir en una categoría que tenga subcategorías; una foto de variante debe pertenecer a una variante del mismo producto.
- **Textos legales:** `StoreSettings` tiene campos para términos, privacidad, envíos y devoluciones. Sus borradores están en `politicas/` y no se deben cargar hasta que se aprueben.
