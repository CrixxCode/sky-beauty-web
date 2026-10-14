# Guion visual (storyboard)

Construido sobre las pantallas reales. Los tiempos son los del render actual (2:53) y se recalculan solos desde las marcas de cada grabación (`scripts/timeline.mjs`). La velocidad indica cuánto se aceleró la grabación real en ese tramo.

| # | Tiempo | Escena | Qué se ve (real) | Texto en pantalla | Cámara | Sonido |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:07 | Introducción | Fondo marfil con brillos lavanda; aparece el ícono SB, el logotipo vertical se revela con una máscara y entra el lema | "Tu belleza, nuestra inspiración" | Fija | Campanas de logo + pad |
| 2 | 0:06–0:27 | Inicio | La ventana sube desde abajo. Portada con carrusel, scroll por categorías, "Recién llegados" (clic en el corazón de una tarjeta), destacados, marcas, ofertas, testimonios | "Descubre tu próxima inspiración" · "Explora por tipo de producto" · "Precios especiales, siempre claros" | Acercamiento lento al titular (1,18x); 1,28x al corazón; sin cámara durante el scroll | Entra el piano y la percusión |
| 3 | 0:27–0:44 | Búsqueda y filtros | Escribe "labial" en el buscador; "Ver todo"; filtra por categoría Demo Labios, marca Demo Aurora y "Solo ofertas" | "Encuentra exactamente lo que buscas" · "Categorías, marcas y ofertas" | 1,5x al buscador; 1,3x a la barra lateral | Clics suaves |
| 4 | 0:44–1:00 | Detalle | Labial mate Demo: cambia de tono (la galería muestra su muestra), pasa por un tono agotado, sube la cantidad, guarda en favoritos y agrega a la bolsa | "Cada tono, con su disponibilidad" · "Elige la cantidad y agrega a la bolsa" | 1,3x al panel de variantes | Clics |
| 5 | 1:00–1:15 | Favoritos y bolsa | Página de favoritos con dos productos, "+" rápido en la crema facial, bolsa con cantidades que cambian y resumen | "Tus favoritos en un solo lugar" · "Tu selección, siempre al día" | 1,12x / 1,22x al resumen | Clics |
| 6 | 1:15–1:41 | Checkout | Datos ficticios (Clienta Demo Video, 300 000 0099), La Guajira → Riohacha (envío de 5.000 calculado), Nequi (instrucciones difuminadas), dos casillas, "Crear pedido" → pedido registrado con botón de WhatsApp | "Compra de manera sencilla" · "El pedido continúa por WhatsApp" | 1,22x al formulario; 1,32x al pedido creado | Campanita al crear el pedido |
| 7 | 1:41–1:47 | Seguimiento sin cuenta | Página privada de seguimiento: avance, pago, envío y productos | "Sigue tu pedido con un enlace privado" | 1,18x | — |
| 8 | 1:47–2:31 | Panel | Pantalla de acceso (sin escribir credenciales) → Resumen → Pedidos: abre el pedido recién creado y lo confirma → Productos: busca "Labial", gestiona variantes, fotos e información → Inventario: filtro "Stock bajo" → Promociones: abre la edición → Reportes: "Más vendidos" | "Control total de tu negocio" · "Gestiona todos tus pedidos" · "Productos con variantes y fotos" · "Existencias por variante" · "Descuentos con fecha de inicio y fin" · "Ventas, más vendidos y márgenes" | 1,12x–1,2x a diálogos y tablas | Barridos en los cambios de sección |
| 9 | 2:31–2:46 | Responsive | La ventana se encoge a la izquierda y entra un teléfono con la grabación real en 390×844: menú, categorías, destacados, detalle y "Agregar a la bolsa" | "Una experiencia para cada pantalla" | Fija | Toques suaves |
| 10 | 2:46–2:53 | Cierre | El morado profundo de la marca se abre desde el centro; logotipo vertical para fondo oscuro y lema; termina con el logotipo centrado | "Belleza a un clic de distancia" | Fija | Acorde final y desvanecimiento |

## Reglas de cámara aplicadas (Huashu Design, `ui-demo-animation.md`)

- La cámara no cambia mientras la página hace scroll.
- Los acercamientos se hacen con la pantalla quieta y vuelven a 1x antes del siguiente cambio grande.
- Un texto sale por completo antes de que entre el siguiente.
- El cursor y la onda de clic son parte de la grabación real (capa visual inyectada en la página).
