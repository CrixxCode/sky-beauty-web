# Video de demostración de Sky Beauty

`output/sky-beauty-demo.mp4`: recorrido de la tienda y del panel administrativo, grabado sobre la aplicación real (compilación de producción local) con datos de demostración, y montado con la identidad oficial de la marca.

| | |
|---|---|
| Duración | ~2:53 (se recalcula si se vuelve a grabar) |
| Formato | MP4 · H.264 (High) · 1920×1080 · 16:9 · 30 fps · `yuv420p` |
| Audio | AAC 192 kbps, 48 kHz, estéreo, normalizado a −16 LUFS |
| Idioma | Español |

## Recorrido

El guion completo, escena por escena, está en [`storyboard.md`](storyboard.md).

1. **Introducción:** ícono SB, logotipo vertical y "Tu belleza, nuestra inspiración".
2. **Inicio:** portada con carrusel, categorías, recién llegados (se guarda un favorito desde la tarjeta), destacados, marcas, precios especiales y testimonios.
3. **Búsqueda y filtros:** búsqueda "labial", catálogo completo, filtros por categoría, marca y "Solo ofertas" combinados.
4. **Detalle del producto:** cambio de tono con galería por variante, tono agotado, cantidad, favoritos y "Agregar a la bolsa".
5. **Favoritos y bolsa:** página de favoritos, "+" rápido desde la tarjeta, cambio de cantidades, descuentos y subtotal.
6. **Checkout:** datos ficticios, departamento y municipio (DANE), envío calculado para Riohacha, método de pago, las dos casillas legales y creación del pedido; pantalla final con el botón de WhatsApp.
7. **Seguimiento sin cuenta:** página privada del pedido (estado, pago, envío y productos).
8. **Panel administrativo:** acceso, resumen con pendientes y ventas de 30 días, pedidos (se confirma el pedido recién creado), productos con variantes, fotos e información, inventario con stock bajo, promociones y reportes.
9. **Responsive:** la misma tienda en escritorio y en un celular de 390×844 (grabación real con pantalla táctil).
10. **Cierre:** logotipo para fondo oscuro y "Belleza a un clic de distancia".

## Lo que el video no muestra (y por qué)

| Pedido en el brief | Situación en el proyecto | En el video |
|---|---|---|
| Cuenta del cliente: inicio de sesión, registro, perfil, historial, direcciones | **No existe por decisión de negocio**: se compra sin cuenta (`Context/negocio.md`, secciones 3 y 13) | La escena 7 muestra lo que sí existe: el seguimiento privado del pedido sin registrarse |
| Ordenamiento del catálogo | No implementado (solo "Solo ofertas", que ordena por descuento) | No se muestra |
| Filtro por rango de precio | No implementado | Se muestra el filtro "Solo ofertas" de la sección Precio |
| Administración de clientes | No hay una sección de clientes en el panel | No se muestra |
| Pago real / pasarela | No existe: el pago se verifica a mano (transferencia, Nequi, Daviplata, contra entrega) | Se elige el método y se muestra que el pedido continúa por WhatsApp; no se pulsa "Abrir WhatsApp" |
| "Explora cientos de productos" | El catálogo real aún no está cargado | El texto se cambió por "Explora por tipo de producto" para no afirmar algo falso |

Las secciones del panel que existen pero no entran en el video por tiempo: Avisos, Pagos, Envíos, Categorías, Marcas, Cuentas, Contenido, Testimonios, Configuración y Mi cuenta.

## Datos, privacidad y cambios en la base de desarrollo

- **Solo local:** la grabación usa el backend de desarrollo (`localhost:4000`) y una compilación de producción del frontend en `localhost:3300`. Los scripts se niegan a correr si `backend/.env` tiene `NODE_ENV=production`.
- **Datos de demostración:** catálogo, marcas, pedidos y testimonios salen de `npm run db:demo` (backend), todos marcados como "Demo". La ventana del video lleva la etiqueta "Datos de demostración".
- **Lo que la grabación modifica, y cómo se revierte:**
  - Crea un pedido de prueba (cliente "Clienta Demo Video", teléfono 300 000 0099, "Calle Ficticia 12 # 34-56") y el panel lo confirma. Cada nueva grabación cancela el pedido de la grabación anterior (con motivo y liberando existencias). `npm run db:demo:clean` los borra junto con el resto de los datos de demostración.
  - Durante la grabación de la tienda, los productos que no son de demostración (hoy, "Prueba") se pausan y al final se reactivan; reactivar conserva su fecha de publicación. Se configura con `HIDE_SLUGS`.
- **Privacidad:** una capa visual inyectada durante la captura difumina correos, números de 7 o más dígitos (por eso no se ven el número de Nequi y el titular configurados en las instrucciones de pago, ni teléfonos de clientes) y el enlace privado de seguimiento del panel. La barra de dirección del montaje oculta el token de seguimiento y abrevia los identificadores. Las credenciales del panel se leen de `backend/.env` y nunca se escriben en pantalla: la escena de acceso muestra el formulario vacío.

## Audio

- **Música:** pista instrumental original, sintetizada por `scripts/audio.mjs` para este video (Fa mayor, 88 BPM; piano eléctrico FM, pad, bajo y percusión suave). No usa grabaciones de terceros, así que no tiene restricciones de licencia.
- **Efectos:** clics, toques, barridos y campanas, también sintetizados, sincronizados con los clics reales de las grabaciones.
- **Por qué no se usó la música de Huashu Design:** sus pistas están etiquetadas "made with suno" y sus efectos se generaron con ElevenLabs. La skill es MIT, pero la licencia comercial de ese audio depende del plan con que se generó, que no está documentado.
- **Para usar una pista licenciada:** `node scripts/audio.mjs --music ruta/a/la-pista.mp3` (se recorta, se le hace fundido de entrada y de salida y se mezcla bajo los efectos). Con `--no-music` quedan solo los efectos.

## Herramientas

- **Playwright 1.64** con Chromium (screencast de DevTools a 1920×1080 nativos, escala forzada 1,333x sobre un viewport de 1440×810; celular a 390×844 con 2x y pantalla táctil).
- **Compositor HTML** propio (`scenes/compositor.html`), renderizado cuadro por cuadro de forma determinista.
- **FFmpeg 6.1** (`ffmpeg-static`) para H.264 y AAC; **ffprobe** (`ffprobe-static`) para la validación.
- **Tipografías** Playfair Display y Poppins (Fontsource, licencia OFL) en local.
- **Huashu Design** como referencia de dirección: interfaz real antes que efectos, cámara contenida, cursor con trayectoria en arco y doble onda de clic, títulos editoriales. Ver [`direction-approved.md`](direction-approved.md) y [`brand-spec.md`](brand-spec.md).

## Cómo regenerar el MP4

Requisitos: Docker con PostgreSQL arriba, backend de desarrollo corriendo en el puerto 4000 con los datos de demostración, Node 24 y conexión a internet solo para instalar dependencias.

```bash
# 0. Datos de demostración (una vez; desde backend/)
npm run db:demo

# 1. Frontend de producción en una carpeta aparte (desde frontend/)
NEXT_DIST_DIR=.next-video NEXT_PUBLIC_SITE_URL=http://localhost:3300 npm run build
NEXT_DIST_DIR=.next-video NEXT_PUBLIC_SITE_URL=http://localhost:3300 npx next start --port 3300

#    (next build agrega .next-video a frontend/tsconfig.json; revierte ese cambio con
#     git checkout -- frontend/tsconfig.json para no subirlo)

# 2. Dependencias del video (desde sky-beauty-video/)
npm install

# 3. Grabar (store debe ir antes que admin: el panel confirma el pedido que crea la tienda)
node scripts/capture.mjs              # store, mobile, login, admin

# 4. Revisar (opcional): hoja de contactos y cuadros sueltos del montaje
node scripts/contact-sheet.mjs store
node scripts/render.mjs --preview 10 45 120

# 5. Renderizar el video y mezclar el audio
node scripts/render.mjs --workers 4
node scripts/audio.mjs

# 6. Validar
node scripts/verify.mjs
```

O todo seguido: `npm run video` (pasos 3, 5 y 6).

## Archivos

```text
sky-beauty-video/
├── assets/brand/         copia sin cambios de los logotipos oficiales
├── assets/fonts/         Playfair Display y Poppins (OFL)
├── recordings/           grabaciones (cuadros JPEG + meta.json con marcas y clics) · ignorado por git
├── scenes/compositor.html   montaje: ventana, cámara, textos, intro y cierre
├── scenes/timeline.json  línea de tiempo del último render · ignorado por git
├── screenshots/          reconocimiento, hojas de revisión y cuadros de muestra · ignorado por git
├── scripts/
│   ├── capture*.mjs      recorridos automatizados (tienda, acceso, panel, celular)
│   ├── lib/              grabador, sesión del navegador, preparación reversible de datos
│   ├── timeline.mjs      tomas, velocidades, cámara, textos y sonidos desde las marcas
│   ├── render.mjs        render paralelo a H.264
│   ├── audio.mjs         música y efectos sintetizados, mezcla y AAC
│   ├── verify.mjs        validación con ffprobe y cuadros de control
│   └── contact-sheet.mjs hojas de revisión
├── output/sky-beauty-demo.mp4   ignorado por git (73 MB): se comparte fuera del repositorio
├── storyboard.md · brand-spec.md · direction-approved.md
└── README.md
```

## Limitaciones conocidas

- Algunos tramos están acelerados entre 1,05x y 2x (el checkout es el más rápido) para que el video dure menos de 3 minutos; las interacciones son las reales.
- En esta versión del video, la lista de productos del panel muestra durante menos de un segundo el producto "Prueba" como "Inactivo", porque el panel se grabó mientras seguía pausado. `scripts/capture.mjs` ya lo reactiva antes de grabar el panel, así que la próxima grabación lo mostrará en su estado real.
- Los productos son ilustraciones de demostración, no fotografías: las fotografías autorizadas siguen pendientes (`Context/decisiones.md`).
- El dominio de la tienda no está decidido: la barra de la ventana muestra "Sky Beauty" y la ruta, sin dominio.
