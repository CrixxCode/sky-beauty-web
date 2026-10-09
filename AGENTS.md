# Reglas para agentes de código — Sky Beauty Maquillaje

Estas reglas aplican a cualquier agente de código (Claude Code, Codex, Cursor, Copilot u otro) que trabaje en este repositorio. Son obligatorias.

## 1. Lee el contexto antes de actuar

Antes de proponer, escribir o modificar código, lee **todos** los archivos de [`Context/`](Context/). Hoy contiene:

- [`Context/negocio.md`](Context/negocio.md): lógica y reglas de negocio.
- [`Context/decisiones.md`](Context/decisiones.md): decisiones confirmadas después de `negocio.md`. Si difieren, prevalece `decisiones.md`.
- [`Context/plan-desarrollo.md`](Context/plan-desarrollo.md): plan de desarrollo por módulos (backend + frontend de cada uno), orden y criterios de terminado. No define reglas de negocio.
- [`Context/politicas/`](Context/politicas/): **borradores** de políticas para clientes. No son vigentes hasta que `decisiones.md` diga que fueron aprobadas; no copies sus plazos o condiciones a la lógica del sistema como si fueran reglas confirmadas.

Si se agregan más archivos a `Context/`, también son de lectura obligatoria.

## 2. No asumas nada

La regla principal de este proyecto: **si algo no está escrito en `Context/` ni lo indicó la persona usuaria en la conversación, no está decidido.**

- No inventes reglas de negocio, valores, políticas, textos comerciales, flujos ni estados.
- No completes vacíos con "lo típico de un e-commerce". Lo habitual en otras tiendas no es una decisión de esta.
- No conviertas algo "propuesto" o "contemplado" en `Context/` en una regla definitiva.
- Si una tarea depende de algo no definido: **detente y pregunta**. Explica qué falta y por qué lo necesitas.
- Si te piden avanzar sin la respuesta, hazlo con un valor **configurable** (no fijo en el código), marcado como pendiente con un comentario `// PENDIENTE: <qué falta confirmar>`, y menciónalo explícitamente en tu respuesta.

### Aspectos que nunca debes asumir

Están pendientes de confirmar con la propietaria (ver sección 13 de `Context/negocio.md`). Si alguno ya aparece en `Context/decisiones.md`, aplica lo confirmado ahí, solo en lo que la decisión dice; el resto del punto sigue pendiente.

- Catálogo real, productos y categorías comerciales.
- Logotipo, paleta definitiva y elementos oficiales de marca.
- Datos de contacto, número comercial de WhatsApp y redes sociales.
- Precios, márgenes y reglas de descuentos (incluido qué promoción gana cuando coinciden varias).
- Políticas de cambios, devoluciones y garantías.
- Cobertura, costos, tarifas y tiempos de envío.
- Condiciones del efectivo contra entrega.
- Condiciones de pago y procedimiento de verificación.
- Tratamiento y conservación de datos personales de clientes.
- Umbrales de inventario bajo.
- Reglas de reserva, descuento y liberación de existencias al confirmar, cancelar o abandonar un pedido.
- Políticas para confirmar, cancelar y devolver pedidos.

No escribas datos de ejemplo (productos, precios, números de teléfono, cuentas bancarias, direcciones) que puedan confundirse con datos reales. Si necesitas datos de prueba, que sean evidentemente ficticios y vivan solo en seeds o pruebas.

## 3. Reglas de negocio que sí están definidas

Estas se desprenden directamente de `Context/negocio.md` y deben respetarse. Las decisiones posteriores (permisos del personal, reserva de stock, cancelación automática, promociones, envío, contra entrega, seguimiento) están en `Context/decisiones.md`:

- Mercado: Colombia. Moneda: pesos colombianos (COP).
- El cliente compra **sin cuenta**: no hay registro ni inicio de sesión de clientes.
- La tienda solo muestra productos habilitados para la venta e indica con claridad cuando una variante no está disponible.
- Las existencias se controlan **por variante**. No se pueden vender unidades no disponibles.
- Todo movimiento de inventario (entrada, salida, ajuste) queda registrado; los ajustes requieren justificación.
- Un pedido conserva la información comercial del momento de la compra; cambios posteriores en el catálogo no lo alteran.
- Son situaciones **distintas** y no se deben fusionar: pedido registrado, mensaje de WhatsApp preparado, mensaje enviado por el cliente, pedido confirmado por la tienda, pago verificado, pedido despachado, pedido entregado.
- Seleccionar un método de pago **no** significa que el pago se recibió. La verificación la hace el negocio.
- Métodos de pago contemplados: transferencia bancaria, Nequi, Daviplata y efectivo contra entrega. Su disponibilidad e instrucciones son configurables.
- Las promociones pueden ser porcentuales o de importe fijo, por producto o por categoría, con fecha de inicio y fin. Se muestran precio regular, descuento y precio final.
- El panel administrativo es de acceso restringido; los clientes no tienen acceso. Además de la propietaria habrá personal con permisos limitados (ver `Context/decisiones.md`).
- Prioridad de la experiencia: móvil, sencilla, sin recargar; los productos deben destacar.

## 4. Cuando el código y el contexto no coinciden

Si encuentras código, esquemas o configuración que contradicen `Context/` (o que asumen algo que el contexto deja pendiente), **no lo corrijas en silencio ni lo tomes como verdad**. Repórtalo a la persona usuaria, indica dónde está la diferencia y pregunta cuál es la correcta.

Orden de prioridad ante conflicto:

1. Instrucción explícita de la persona usuaria en la conversación actual.
2. Archivos de `Context/`.
3. Código existente.

## 5. Mantener el contexto

- No modifiques archivos de `Context/` para registrar decisiones de negocio salvo que la persona usuaria lo pida y la decisión haya sido confirmada.
- Si durante el trabajo se confirma una decisión nueva, sugiere registrarla en `Context/decisiones.md` con su fecha.
