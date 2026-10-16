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
- eliminar productos, marcas y categorías (2026-10-14). El personal sí puede eliminar variantes y quitar fotos de un producto, como parte de editarlo.

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

## 2026-10-15 — Existencias exactas en la API pública

**Decisión:** la API pública puede seguir enviando la cantidad exacta en existencia de cada variante (`stock` en el catálogo y `maxQuantity` en la cotización). Completa la decisión "Disponibilidad de variantes en la tienda" (2026-10-13): la restricción de no mostrar la cantidad aplica solo a lo que el cliente ve en la tienda, que sigue indicando únicamente si la variante está disponible o agotada.

---

## 2026-10-15 — Sin precio final de 0 COP

**Decisión:** ningún producto puede quedar con un precio final de 0 COP en la tienda, la bolsa, el checkout ni en un pedido. Aplica a todas las vías:

- precio base del producto o precio propio de la variante en 0;
- promoción porcentual del 100 %;
- promoción de importe fijo igual o mayor que el precio;
- redondeo del descuento.

Esto ajusta lo dicho en "Cifras configurables sin valor inicial": sin límite configurado, una promoción porcentual tampoco puede llegar al 100 %.

**Cómo se impide (confirmado el 2026-10-15):**

- Se rechazan el precio base y el precio propio de una variante en 0.
- Se rechaza una promoción porcentual del 100 %.
- Al guardar una promoción de importe fijo, se rechaza si deja algún destino en 0 o menos.
- Si después baja el precio de una variante hasta el descuento fijo de una promoción vigente o por debajo, esa promoción no se le aplica.
- El redondeo del descuento nunca deja el precio final por debajo de 1 COP.

---

## 2026-10-15 — Costo de envío modificable después del pago

**Decisión:** la tienda puede cambiar el costo de envío de un pedido después de confirmarlo e incluso después de verificar el pago, mientras no esté entregado ni cancelado. El total del pedido se recalcula y el cambio queda en su historial.

**Pendiente:** ~~si el envío sube después de verificado el pago, si el pedido sigue como pagado o queda una diferencia por cobrar.~~ Resuelto el 2026-10-16: ver "El envío no sube mientras el pedido está pagado".

---

## 2026-10-15 — Cancelar un pedido pagado exige la devolución

**Decisión:** un pedido con el pago verificado no se puede cancelar sin registrar la devolución del dinero. Nunca debe quedar un pedido cancelado con el pago como verificado.

**Procedimiento (confirmado el 2026-10-15):** primero se registra la devolución total del dinero y después se cancela el pedido. Mientras el pago siga verificado, el panel no permite cancelarlo y explica que falta registrar la devolución.

**Pendiente:** ~~qué hacer cuando el monto verificado no coincide con el total y cómo registrar devoluciones parciales.~~ Resuelto el 2026-10-16: ver "Monto verificado distinto del total y devoluciones totales".

---

## 2026-10-16 — Monto verificado distinto del total y devoluciones totales

**Decisión (Q-04):** al verificar un pago por transferencia, Nequi o Daviplata:

- **Monto menor que el total:** no se marca como pagado. Se registra como pago incompleto y queda rechazado, lo que abre el plazo de aclaración de 8 horas que ya existe (ver "Cancelación automática de pedidos confirmados sin pago").
- **Monto mayor que el total:** se marca como pagado por el total del pedido y la nota es obligatoria. Queda registrado el excedente por devolver, que se devuelve a mano. No se suma como ingreso del pedido ni hay una gestión automática de excedentes.
- **Devoluciones:** solo se aceptan devoluciones **totales** del monto verificado. Las parciales no se registran. Para cancelar un pedido pagado, primero se registra la devolución total (ver "Cancelar un pedido pagado exige la devolución").

---

## 2026-10-16 — El envío no sube mientras el pedido está pagado

**Decisión (Q-21):** completa "Costo de envío modificable después del pago". Mientras el pedido tenga el pago verificado, **no se puede aumentar** su costo de envío: la API lo rechaza y el panel bloquea el guardado explicando el motivo. Así el pedido nunca queda como pagado con un total mayor al pagado.

El resto de esa decisión no cambia.

---

## 2026-10-16 — Textos legales aprobados

**Decisión:** la propietaria aprobó los cuatro textos legales (términos y condiciones, tratamiento de datos personales, cambios y garantías, y envíos) y están cargados en la base de la tienda, sin marcadores `[PENDIENTE]`. Reemplaza el pendiente de aprobación de "Políticas y términos para clientes" (2026-10-09).

**Sin revisión legal:** no se validaron con asesoría legal. La propietaria asume ese riesgo y lo confirmó.

**Pendiente:** cargar los mismos textos en la base de Railway cuando se despliegue; el despliegue no copia la base local.

---

## 2026-10-16 — Integración continua con GitHub Actions

**Decisión (Q-12):** se autoriza GitHub Actions en su plan gratuito. El flujo `QA` (`.github/workflows/qa.yml`) corre las pruebas en cada push a `dev` y `main` y en cada solicitud de cambios, y construye las imágenes de producción. **No despliega automáticamente** y no lleva credenciales reales.

---

## 2026-10-16 — Copias de seguridad manuales

**Decisión:** las copias de la base de datos y de las fotos se hacen **a mano, una vez por semana y antes de cada despliegue**, conservando las **dos últimas en el computador** de la persona usuaria. No se contrata almacenamiento externo, no hay programación periódica ni borrado automático. Procedimiento en `docs/deployment/BACKUPS.md`.

Resuelve el pendiente de copias de seguridad de "Infraestructura sin servicios de pago".

---

## 2026-10-16 — Metas de rendimiento iniciales

**Decisión (Q-15):** para el inicio del emprendimiento, el percentil 95 de respuesta debe ser de **1,5 s o menos** en búsqueda y ofertas con 20 conexiones simultáneas, y de **1 s o menos** en el catálogo con 50 conexiones. Cumplidas en pruebas locales con 2.000 productos.

**Pendiente:** comprobarlas en Railway antes de abrir ventas.

---

## 2026-10-16 — Validación en producción y aceptación final

**Decisiones:**

- **Sin entorno de pruebas aparte (Q-14):** la validación previa a abrir ventas se hace en el único entorno de Railway, con datos ficticios evidentes que se borran antes de abrir. No se crea un segundo entorno.
- **Aceptación final (Q-16):** el desarrollador ejecuta las pruebas manuales en el entorno desplegado y la propietaria da el visto bueno final, incluido un pedido de prueba enviado por WhatsApp desde su celular.

**Pendiente:** confirmar que el volumen persistente de Railway para las fotos entra dentro del gasto permitido (ver "Infraestructura sin servicios de pago").

---

## 2026-10-16 — El enlace del producto no cambia al renombrarlo

**Decisión (Q-07):** cambiar el nombre de un producto no cambia su enlace (`slug`), para que los enlaces ya compartidos por WhatsApp o redes sigan funcionando. El enlace solo cambia si se edita de forma explícita en el campo del enlace.

---

## 2026-10-16 — Publicar un producto exige una variante activa

**Decisión (Q-18):** un producto no se puede publicar (pasar a activo) si no tiene al menos una variante activa. La API responde 400 y el panel muestra el motivo.

Solo cubre el momento de publicar: no cambia qué ocurre si después se desactivan o eliminan sus variantes.

---

## 2026-10-16 — Categoría o marca inactiva oculta sus productos

**Decisión (Q-09):** un producto no se muestra ni se puede comprar si su marca está inactiva, si su categoría está inactiva o si es de una subcategoría cuya categoría padre está inactiva. Aplica al listado, la búsqueda, las ofertas, los favoritos, el detalle (por enlace directo), la bolsa y el checkout, la edición de pedidos sin confirmar, los testimonios que lo mencionan y el menú de categorías y marcas (una categoría o marca sin productos visibles no aparece). Al reactivarlas, los productos vuelven.

No cambia los pedidos ya hechos, que conservan su información.

---

## 2026-10-16 — Pedido en preparación sin comprobante

**Decisión (Q-19):** un pedido en preparación que sigue sin comprobante de pago a las 24 horas de confirmado también se cancela automáticamente, igual que uno confirmado (ver "Cancelación automática de pedidos confirmados sin pago"). No aplica al contra entrega.

---

## 2026-10-14 — Tope general de unidades por producto

**Decisión:** la tienda tiene un tope general de unidades de un mismo producto (variante) por pedido, para todos los productos. Se combina con el máximo propio de cada variante: aplica el menor de los dos.

- La cifra la fija la propietaria en Configuración → Cifras comerciales. Sin cifra no hay tope general (solo el de cada variante, si lo tiene).
- Aplica en la tienda, el carrito, el checkout y la edición de pedidos sin confirmar.

**Pendiente:** la cifra del tope.

---

## 2026-10-14 — Resumen del panel

**Decisión:** el Resumen del panel muestra:

- **A todo el panel:** los pendientes del día (pedidos por confirmar, pagos por verificar, avisos por enviar y variantes con stock bajo), cada uno con enlace a su sección.
- **Solo a la propietaria:** las ventas de los últimos 30 días (total vendido, pedidos pagados, ticket promedio y gráfico por día), con el mismo criterio de los reportes.

---

## 2026-10-14 — El prototipo es un punto de partida

**Decisión:** el prototipo de referencia fue una estructura inicial, un punto de partida para desarrollar las vistas. Ya no es obligatorio que las vistas (tienda y panel) se vean tal cual el prototipo. Reemplaza lo dicho sobre el prototipo en "Identidad visual y prototipo de referencia".

- Las vistas parten del lenguaje visual del prototipo y pueden apartarse de él para mejorar la usabilidad, la accesibilidad y la experiencia en celular.
- Siguen vigentes los colores, tipografías, logotipos e ícono oficiales, y el alcance del prototipo: no se construyen sus funciones que el contexto descarta o no menciona, ni se copian sus datos de demostración.

**Tamaño mínimo de texto en la tienda:** todo texto de la tienda pública mide como mínimo 12 px. En celular, los campos de formulario usan 16 px. Esta decisión no cambia el panel administrativo.

---

## 2026-10-14 — Favoritos sin cuenta

**Decisión:** la tienda tiene favoritos. Como no hay cuentas de clientes, se guardan en el navegador de cada cliente.

- El cliente guarda o quita un producto con el corazón de la tarjeta o del detalle, y los ve en la página "Favoritos" (`/favoritos`), con un contador en el encabezado.
- No pasan a otros dispositivos y se pierden si el cliente borra los datos del navegador. La página lo dice.
- Máximo 100 productos guardados.
- Solo se muestran los productos que siguen publicados; si alguno dejó de estarlo, la página lo avisa y permite quitarlo.

---

## 2026-10-14 — Testimonios de clientas

**Decisión:** la tienda muestra testimonios de clientas en el inicio.

- **Origen:** los registra la propietaria en el panel a partir de opiniones reales que recibió (por WhatsApp o redes). No hay formulario público para que los clientes los envíen.
- **Qué se publica:** nombre y primera letra del apellido (por ejemplo, "María G."), valoración de 1 a 5, comentario y, si la propietaria lo indica, el producto que compró. El producto solo se muestra mientras siga publicado.
- **Publicación:** cada testimonio se publica u oculta desde el panel. El inicio muestra hasta 6 publicados, del más reciente al más antiguo. Sin testimonios publicados, la sección no aparece.
- **Permisos:** como el resto del contenido, solo la propietaria los crea, edita, publica y elimina; el personal los consulta.

**Pendiente:** cómo se registra la autorización de la clienta para publicar su nombre e inicial (Ley 1581 de 2012).

---

## 2026-10-14 — Página de ofertas

**Decisión:** la tienda tiene una vista de ofertas con los productos que tienen una promoción vigente, ordenados del mayor al menor descuento. Es el catálogo con el filtro "Solo ofertas" (`/productos?ofertas=1`), que se combina con los demás filtros, y se enlaza desde el menú de categorías, el pie y la franja de ofertas del inicio.

---

## 2026-10-14 — Agregar a la bolsa desde la tarjeta del producto

**Decisión:** las tarjetas de producto (inicio, catálogo y favoritos) tienen un botón "+" para agregar una unidad a la bolsa sin entrar al detalle, solo en productos de una sola variante. Con varias variantes, la tarjeta lleva al detalle para elegir. Respeta las existencias y el máximo por pedido, como el detalle.

---

## 2026-10-14 — Sin suscripción a novedades por ahora

**Decisión:** la tienda no tiene suscripción a novedades (formulario para dejar el correo) por ahora. No se guardan correos de clientes con fines comerciales.

Motivo: no hay servicio de correo para enviar las novedades (ver "Infraestructura sin servicios de pago") y la política de tratamiento de datos personales sigue en borrador.

---

## 2026-10-14 — Logotipos para fondo oscuro

**Decisión:** se incorporan las versiones oficiales del logotipo para fondo morado, en blanco y crema, ubicadas en `frontend/public/brand/`:

- `logo_vertical_dark.svg`: logotipo vertical para fondo oscuro. Se usa en el pie de la tienda, en lugar del nombre de la tienda en texto.
- `logo_horizontal_dark.svg`: logotipo horizontal para fondo oscuro. Queda disponible; todavía no se usa en ninguna vista.

Los logotipos de la entrada del 2026-10-13 siguen usándose sobre fondos claros.

**Pendiente:** el logotipo monocromo. Estas versiones son de dos colores, así que no lo reemplazan.

---

## 2026-10-14 — Crédito del desarrollo en el pie

**Decisión:** la propietaria aprobó que el pie de la tienda muestre "Desarrollado por Cristian Ramirez" con su símbolo (`frontend/public/brand/cr_dev.svg`). Va en la franja inferior y enlaza a https://cristianramirez.up.railway.app en otra pestaña.

---

## 2026-10-13 — Reportes de ventas y ganancia

**Decisión:** la propietaria tiene reportes de ventas por período, productos más vendidos y márgenes, y puede exportar cada uno a CSV.

- **Qué es una venta:** un pedido con el pago verificado (`paymentStatus = PAID`), incluido el contra entrega pagado al entregarse. No cuentan los pedidos cancelados ni los devueltos.
- **Fecha de la venta (2026-10-14):** cada venta se ubica en la fecha en que se verificó el pago, no en la del pedido, porque un pedido cuyo pago no se logra verificar se cancela. En el contra entrega es la fecha en que se marcó entregado y pagado.
- **Ganancia:** solo de productos. Es lo vendido en productos (con los descuentos aplicados) menos el costo de compra guardado en el pedido. El envío se muestra aparte: lo cobrado al cliente y el costo real registrado de la transportadora.
- **Acceso:** solo la propietaria. El personal no ve los reportes.

---

## 2026-10-13 — Notificaciones del panel

**Decisión:** el panel administrativo tiene un panel de notificaciones (campana con contador en la cabecera) para la propietaria y el personal. Avisa cuando:

- hay un aviso de cancelación por enviar al cliente (antes o después de cancelar);
- el sistema canceló un pedido automáticamente por plazo vencido.

Cada usuario marca sus notificaciones como leídas por su cuenta. Los avisos al cliente se envían desde la bandeja "Avisos" del panel, que abre WhatsApp con el chat del cliente y el mensaje aprobado, y se marcan como enviados a mano.

---

## 2026-10-13 — Rastreador por código y teléfono

**Decisión:** además del enlace privado, el cliente puede consultar su pedido en la página "Rastrear pedido" (`/rastrear`, enlazada desde el pie de la tienda) escribiendo el **código del pedido** y el **teléfono con el que compró**.

- Si los dos coinciden, se abre el mismo seguimiento privado. El teléfono se acepta escrito de cualquier forma, como en el checkout.
- Si no coinciden, se responde siempre el mismo mensaje genérico, sin decir cuál dato falló.
- El código solo no basta, porque no es secreto (aparece en WhatsApp y en capturas).
- Máximo 5 intentos por minuto desde la misma conexión.

---

## 2026-10-13 — Información de la página de seguimiento

**Decisión:** completa el pendiente de "Seguimiento del pedido con enlace privado". La página de seguimiento muestra:

- código, fecha y estado del pedido, con su avance (registrado, confirmado, preparando, despachado, entregado);
- método y estado del pago;
- estado del envío y, según el tipo de entrega, transportadora, guía y enlace de rastreo, o "Entrega local de la tienda";
- productos (nombre, variante, cantidad y precio), subtotal, descuentos, envío y total.

No muestra datos del cliente (nombre, teléfono, dirección, indicaciones) ni datos internos (costos, notas internas). Los avisos de cancelación se agregan con el módulo 11.

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
- El descuento porcentual solo está limitado por el tope técnico del 100 %. (Ajustado el 2026-10-15: no puede llegar al 100 %, ver "Sin precio final de 0 COP".)
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

- ~~Revisión y aprobación de la propietaria, y validación con asesoría legal. Hasta entonces son **borradores**: no se deben tratar como políticas vigentes ni publicar.~~ Actualizado el 2026-10-16: la propietaria los aprobó, sin validación legal (ver "Textos legales aprobados"). Los archivos de `politicas/` siguen siendo los borradores originales; los textos vigentes son los cargados en la base.
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
- **Prototipo de referencia:** `C:\Users\Usuario\Downloads\Sky_Beauty_React_Demo\sky-beauty-demo`. ~~Toda vista del frontend (tienda y panel) debe verse tal cual el prototipo.~~ Reemplazado el 2026-10-14: el prototipo es un punto de partida (ver "El prototipo es un punto de partida").
- **Alcance del prototipo:** se copia solo el diseño. La funcionalidad sigue `negocio.md` y este archivo; las funciones del prototipo que el contexto descarta o no menciona (cuentas y registro de clientes, favoritos, cupones, recuperación por correo, testimonios) no se construyen sin consultarlo. Favoritos y testimonios se consultaron y aprobaron el 2026-10-14 (ver "Favoritos sin cuenta" y "Testimonios de clientas"); el resto sigue sin construirse.

**Pendiente:** el logotipo monocromo y las fotografías autorizadas. Los logotipos horizontal y vertical y el ícono ya se incorporaron (ver la entrada del 2026-10-13), y sus versiones para fondo oscuro también (ver "Logotipos para fondo oscuro", 2026-10-14).

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
- ~~Cómo se harán las copias de seguridad de la base de datos y de las imágenes.~~ Resuelto el 2026-10-16: ver "Copias de seguridad manuales".

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
- **Tope de unidades:** `StoreSettings.maxUnitsPerProduct` (`null` = sin tope general), combinado con `ProductVariant.maxPerOrder` (gana el menor).
- **Resumen:** `GET /admin/dashboard/pending` (todo el panel); las ventas salen de `GET /admin/reports/sales` (solo `ADMIN`).
- **Reportes:** `GET /admin/reports/sales`, `top-products` y `margins` (solo `ADMIN`). Los días se cuentan en hora de Colombia y las ventas se ubican por `Order.paidAt` (fecha de verificación del pago; migración `20261014000000_fecha_pago_verificado`, que completa los pedidos anteriores con su primer registro de pago verificado). Las unidades vendidas sin `unitCost` quedan fuera de la ganancia y se informan aparte.
- **Permisos:** documentados en `AdminRole`.
- **Texto mínimo de la tienda:** el layout de la tienda marca su área con `data-area="store"` y `globals.css` define la variante `store:`, que sube a 12 px los componentes compartidos con el panel solo dentro de la tienda.
- **Favoritos:** en el navegador (`localStorage`, clave `sky-beauty-favorites`), en `frontend/src/features/favorites/`. La página `/favoritos` consulta `GET /store/products?ids=...` (máximo 100 ids; solo devuelve productos publicados) y no se indexa en buscadores.
- **Testimonios:** tabla `Testimonial` (migración `20261014040000_testimonios`, con la valoración restringida a 1–5 en la base de datos). Panel: `/admin/testimonios` (`/admin/testimonials`: escritura solo `ADMIN`). Tienda: `GET /store/testimonials` (publicados, máximo 6, nombre con la inicial del apellido).
- **Ofertas y destacados:** `GET /store/products` acepta `featured=true` y `onSale=true`. Para las ofertas, primero se toman los productos que alcanza alguna promoción vigente; luego se calculan sus precios con el motor de promociones, se dejan solo los que tienen descuento y se ordenan por descuento. El catálogo lo usa con `?ofertas=1`.
- **Sin precio final de 0 COP (2026-10-15):** los DTO exigen precios mayores que 0 (`@IsPositive`). `PromotionsService` rechaza los porcentajes de 100 o más y los descuentos fijos que dejarían algún destino en 0 o menos. `calculateDiscount` no aplica un descuento que iguale o supere el precio y limita el redondeo para que el precio final quede en al menos 1 COP.
- **Cancelar un pedido pagado (2026-10-15):** `OrdersService.cancel` rechaza un pedido con `paymentStatus = PAID`; el panel muestra la explicación en lugar del formulario de cancelación.
- **Pagos y envío (2026-10-16):** `OrdersService.verifyPayment` rechaza como pago incompleto un monto menor (abre `paymentRejectedAt`) y exige nota ante un excedente; `refundPayment` solo acepta la devolución total; `quoteShipping` no permite subir el envío con el pago verificado.
- **Visibilidad en la tienda (2026-10-16):** `backend/src/modules/catalog/products/public-visibility.ts` define en un solo lugar qué producto se muestra y se puede comprar (`publicProductWhere`: publicado, marca activa, categoría visible). Lo usan el listado, la búsqueda, las ofertas, los favoritos, el detalle, la cotización del carrito, la edición de pedidos, los testimonios y los listados públicos de categorías y marcas.
- **Enlace y publicación (2026-10-16):** `ProductsService.update` ya no regenera el `slug` al cambiar el nombre; `changeStatus` rechaza publicar sin una variante activa.

### Pendiente en el código

- El proceso que ejecuta las cancelaciones automáticas.
- **Avisos de cancelación:** registrar qué avisos se enviaron por WhatsApp, mostrarle al personal qué pedidos necesitan aviso y mostrar el aviso en la página de seguimiento.
- **Permisos:** aplicarlos en el backend al implementar el panel, incluidas las excepciones del personal (cancelación por pago no demostrado y pago contra entrega al entregarse) y la restricción de costos.
- **Historiales:** la aplicación debe escribir una fila en `VariantPriceHistory` cada vez que cambie el precio efectivo de una variante (incluida su creación y los cambios de `Product.basePrice`), y una `PromotionRevision` al crear o modificar una promoción.
- **Limitación conocida:** la pertenencia de un producto a una categoría y la estructura de subcategorías no tienen historial. Si un producto cambia de categoría, al editar un pedido anterior las promociones de categoría se evalúan con su categoría actual.
- **Reglas entre filas que valida la aplicación:** máximo dos niveles de categorías; un producto no puede ir en una categoría que tenga subcategorías; una foto de variante debe pertenecer a una variante del mismo producto.
- **Textos legales:** `StoreSettings` tiene campos para términos, privacidad, envíos y devoluciones. Sus borradores están en `politicas/` y no se deben cargar hasta que se aprueben.