# Pruebas fallidas — ejecución del 2026-10-15

Seguimiento posterior: [preparación del despliegue y verificaciones del 2026-10-16](PREPARACION_DESPLIEGUE_2026-10-16.md).
Las tablas de esta ejecución conservan la evidencia histórica del 15 de octubre.

Casos con resultado **Fallido** en la ejecución del plan de QA. En total son 32: 22 del backend y 10 del frontend; los escenarios E2E y los smoke no tuvieron fallas.

Los casos están ordenados por la prioridad que les asigna el plan (P0 primero) y, dentro de cada prioridad, agrupados por defecto. La columna "Defecto" remite a la sección 3 de [`RESULTADOS_EJECUCION_2026-10-15.md`](RESULTADOS_EJECUCION_2026-10-15.md), donde está el detalle y la evidencia completa de cada caso.

Este listado no incluye los 14 casos **parciales** ni las 18 **caracterizaciones**; están en el informe completo.

## Estado de las correcciones (actualizado el 2026-10-15)

Cada corrección está en un commit propio en `dev`, con su prueba automatizada, y se repitió el caso que había fallado. Al cerrar: backend con 45 pruebas unitarias y 185 de integración aprobadas, frontend con 51 unitarias y Playwright 40/40, y axe sin violaciones en 29 páginas.

| Defecto | Estado | Commit | Verificación |
|---|---|---|---|
| D-01 Precio final 0 COP | Corregido (mecanismo de Q-22 confirmado: rechazar precios en 0 y promociones del 100 %; rechazar al guardar un descuento fijo que deje algún destino en 0 o menos; si el precio baja después, ese descuento no se aplica; el redondeo nunca deja menos de 1 COP) | `52ecd1a` | Pruebas de integración y del formulario |
| D-02 Cancelar un pedido pagado | Corregido (Q-05: primero la devolución total; las parciales siguen pendientes de Q-04) | `e7a5878` | Integración y FE-110 en el navegador |
| D-03 Paginación del panel | Corregido en pedidos, productos y promociones, y en los selectores de productos | `1f06dc0` | FE-109 en el navegador (5.255 pedidos, 2.238 productos, 69 promociones) |
| D-04 Capacidad bajo carga | **Mejorado, sigue abierto** (ver abajo) | `0620774` | BE-227 y BE-228 repetidos |
| D-05 Quitar una tarifa de envío | Corregido (incluye BE-053) | `f340f28` | Integración y FE-099 en el navegador |
| D-06 Existencias iniciales simultáneas | Corregido (bloqueo de la variante) | `fcc1455` | Prueba de concurrencia |
| D-07 Respuestas 500 ante entradas inválidas | Corregido en los siete casos | `9a71d34` | Integración y E2E |
| D-08 Accesibilidad | Corregido (contraste, nombres accesibles, áreas táctiles) | `8602306` | axe: 0 violaciones en 29 páginas |
| D-09 Base de las pruebas | Corregido (exige una base `*_test`) | `877a214` | — |
| D-10 Favoritos corruptos | Corregido (también en la bolsa y los filtros) | `90df8da` | FE-044 en el navegador |
| D-11 Sesión vencida en el panel | Corregido: aviso "Tu sesión terminó" y vuelta al inicio de sesión, sin el error genérico de la acción | `290982e`, `f9ff12e` | FE-094 en el navegador |
| D-12 y D-14 Orden en español y comodines | Corregido | `fec25f0` | Integración |
| D-13 y D-15 Validación en español y claves peligrosas | Corregido | `7728ca5` | Integración |
| D-16 Pedido sin WhatsApp | Corregido: título "Guarda tu código de pedido", contacto de la tienda y página sin indexar | `447378e` | FE-071 en el navegador |
| D-17 Fecha de cancelación | Corregido ("Cancelado el …" en el seguimiento) | `32091ce` | FE-077 en el navegador |
| D-18 Doble punto en el aviso | Corregido | `bc9d03a` | Integración |
| D-19 CLS del checkout vacío | Corregido: CLS 0,008 | `030c7be` | FE-123 en el navegador |
| D-20 Área táctil del título de la tarjeta | Corregido junto con D-08 | `8602306` | Playwright |
| D-21 Máximo por pedido | Corregido: se informa solo cuando no revela las existencias | `56ce0c8` | FE-032 en el navegador |
| D-22 Movimiento reducido | Sin cambio: `globals.css` ya quita el movimiento; lo que queda son fundidos de opacidad | — | — |
| D-23 Texto del error global | Corregido | `b6ab937` | — |

### D-04: qué cambió y qué falta

**Corrección del arnés.** El arnés original leía la memoria del proceso con una llamada síncrona cada 3 s, que bloqueaba al cliente de carga y aumentaba las latencias medidas. Se corrigió y las cifras de abajo usan el arnés corregido. Aun así, la mejora del código se confirmó con un perfilado en las mismas condiciones antes y después: búsqueda y ofertas pasaron de 17 a 52 peticiones por segundo.

**Cambio.** La búsqueda y "Solo ofertas" ya no cargan el catálogo completo:
- Se decide qué productos coinciden con datos mínimos.
- Las ofertas solo consideran los productos que alcanza alguna promoción vigente.
- El detalle completo se carga solo para la página pedida.

El resultado no cambia (prueba de integración nueva).

Resultados con unos 2.200 productos activos:

| Caso | Antes | Ahora | Meta propuesta (Q-15, sin confirmar) |
|---|---|---|---|
| BE-228, búsqueda y ofertas, 20 conexiones | 2 pet./s, p95 14,3 s, memoria 364 → 955 MB | 30 pet./s, p95 1,0 s, memoria 466 → 507 MB | p95 < 1 s |
| BE-228 con 509 productos activos | 3 pet./s, p95 12,0 s | 44 pet./s, p95 596 ms | p95 < 1 s |
| BE-227, catálogo, 50 conexiones | p95 ≈ 11 s | 82 pet./s, p95 743 ms | p95 < 500 ms |

**Pendiente:**
- Las metas dependen de Q-15 (productos y visitantes simultáneos esperados).
- Con 50 conexiones simultáneas, el catálogo queda limitado por la CPU de un solo proceso. Alrededor del 30 % se va en Prisma y alrededor del 9 % en escribir el log de cada petición.
- Bajar de 500 ms requeriría más capacidad (más instancias o CPU) o caché, y eso es una decisión de despliegue.
- Hay que repetir la medición en Railway antes de lanzar.

## P0 — bloquean la liberación (6)

| ID | Escenario | Qué falló | Defecto |
|---|---|---|---|
| BE-102 | Límite porcentual configurado y tope técnico | Se acepta una promoción del 100 % sin límite configurado; el precio final quedaría en 0 | D-01 |
| BE-106 | Un descuento fijo no puede dejar el precio en 0 | Descuentos fijos de 25.000 y 20.000 sobre un producto de 20.000 se aceptan; la tienda, la cotización y el pedido quedan en 0 COP | D-01 |
| BE-108 | Redondeo al peso sin descuadres ni precio 0 | Una variante de 1 COP con 50 % de descuento queda en 0 por redondeo (los totales sí cuadran) | D-01 |
| FE-105 | Crear y publicar con variantes y fotos | El formulario del panel crea un producto con precio base 0 | D-01 |
| FE-110 | Detalle y acciones según rol | En un pedido pagado, "Cancelar pedido y liberar existencias" se habilita sin exigir ni explicar la devolución previa | D-02 |
| BE-218 | Las pruebas nunca usan la base de desarrollo | Con una `TEST_DATABASE_URL` sin `_test`, la suite de integración corre sobre esa base y la borra; solo se protege si es idéntica a `DATABASE_URL` | D-09 |

## P1 — importantes (14)

| ID | Escenario | Qué falló | Defecto |
|---|---|---|---|
| BE-068 | Campos obligatorios y precio base positivo | Se acepta `basePrice` 0 | D-01 |
| BE-073 | Validación y unicidad de variantes | Se acepta `price` 0 en una variante | D-01 |
| BE-107 | Promoción del 100 % | Crear y editar una promoción al 100 % se aceptan | D-01 |
| BE-143 | Ningún pedido con artículos a precio 0 | Existe un pedido con un artículo a precio final 0 (creado en BE-106) | D-01 |
| FE-108 | Crear, validar y versiones (promociones) | El panel crea una promoción del 100 % ("Promoción creada.") | D-01 |
| BE-158 | Cancelar un pedido con pago verificado exige la devolución | Se cancela sin devolución y queda `CANCELLED` con `PAID` | D-02 |
| FE-109 | Bandeja con filtros (pedidos) | Sin paginación: muestra 20 de 189 pedidos y no hay forma de ver los anteriores salvo buscando; productos y promociones igual | D-03 |
| FE-099 | Datos, cifras y tarifas | Al quitar una tarifa de envío, el panel dice "No se pudo eliminar la tarifa." aunque se borró, y la deja en la lista hasta recargar | D-05 |
| BE-096 | Dos existencias iniciales simultáneas | En 5 de 5 intentos se registran dos movimientos `INITIAL` | D-06 |
| BE-009 | Mapeo de errores | Un cuerpo JSON demasiado grande responde 500 en lugar de 413 | D-07 |
| BE-077 | Archivo que no es imagen con tipo de imagen | Un texto enviado como PNG responde 500 en lugar de 400 | D-07 |
| FE-118 | Análisis automático WCAG 2.1 AA | Contraste insuficiente (inicio y panel) y desplegables "Todos los estados" / "Todos los pagos" sin nombre accesible | D-08 |
| FE-094 | Sesión que vence durante una acción | Muestra "No se pudo cambiar la contraseña. Intenta de nuevo." sin explicar que la sesión venció ni redirigir al inicio de sesión | D-11 |
| BE-220 | Inyección en búsquedas del panel | `q=%` funciona como comodín y devuelve todo (no hay fuga de datos ni errores) | D-14 |

## P2 — secundarias (12)

| ID | Escenario | Qué falló | Defecto |
|---|---|---|---|
| BE-111 | Descuento fijo de categoría sobre productos de distinto precio | Un descuento fijo de 15.000 deja en 0 un producto de 10.000 | D-01 |
| FE-130 | Validaciones de formularios | El formulario de producto acepta precio 0; el esquema de testimonios no tiene pruebas | D-01 |
| BE-227 | Catálogo bajo carga | p95 de 10,5–11,4 s con 50 conexiones (meta propuesta: 500 ms); unas 10–13 peticiones/s | D-04 |
| BE-228 | Búsqueda y ofertas con catálogo grande | p95 de 12–14 s con 20 conexiones (meta propuesta: 1 s); la memoria sube de 364 a 955 MB y no baja | D-04 |
| BE-053 | Borrar tarifa con identificador malformado | `DELETE /admin/settings/shipping-rates/abc` responde 500 | D-07 |
| BE-081 | Imagen con dimensiones extremas | Un PNG de 20.000×20.000 px responde 500 (el proceso no se cae) | D-07 |
| BE-097 | Cantidad fuera del rango de `Int` | `PURCHASE 3000000000` responde 500 | D-07 |
| BE-145 | Filtro con valor inexistente | `/admin/orders?status=NO_EXISTE` responde 500 | D-07 |
| FE-026 | Parámetros malformados en la URL | `/productos?categoria=abc` muestra la página de error (500) con un mensaje de conexión engañoso | D-07 |
| FE-044 | Datos guardados corruptos | Un favorito guardado como texto inválido (`"x"`) hace fallar toda la página de favoritos | D-10 |
| BE-061 | Departamentos y municipios oficiales | Orden no alfabético en español: "Córdoba" aparece después de "Cundinamarca" | D-12 |
| BE-221 | Contaminación de prototipo y tipos inesperados | Cuerpos con `__proto__` o `constructor` responden 200 en lugar de 400 (no se observó contaminación) | D-15 |

## Por dónde empezar

Atacar primero los defectos que más casos resuelven:

1. **D-01:** resuelve 11 casos y está decidido por Q-02. Falta definir el mecanismo (Q-22).
2. **D-02:** está decidido por Q-05.
3. **D-03:** paginación del panel.
4. **D-09:** protección de la base en las pruebas.
5. **D-07:** respuestas 500 ante entradas inválidas, siete casos con la misma raíz.
