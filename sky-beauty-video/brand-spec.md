# Especificación de marca para el video

Fuente: `Context/decisiones.md` (identidad visual confirmada) y los archivos oficiales de `frontend/public/brand/`. Nada de esta lista se inventó para el video.

## Activos

| Activo | Archivo | Uso en el video |
|---|---|---|
| Ícono oficial (SB) | `assets/brand/favicon.svg` | Primer elemento de la introducción |
| Logotipo vertical | `assets/brand/vertical_logo.svg` | Introducción, sobre fondo claro |
| Logotipo vertical para fondo oscuro | `assets/brand/logo_vertical_dark.svg` | Cierre, sobre fondo morado |
| Crédito del desarrollo | `assets/brand/desarrollado-por-cristian-ramirez-morado.png` | Última escena, a pantalla completa (pedido por la persona usuaria el 2026-10-14) |
| Interfaz real | Grabaciones de `recordings/` | Escenas 2 a 9 |

Los logotipos se copian sin cambios (`assets/brand/` es una copia de `frontend/public/brand/`). En el video solo se animan su opacidad, escala y una máscara de aparición; no se recolorean ni se deforman.

## Color (tokens de `frontend/src/app/globals.css`)

| Token | Valor | Uso |
|---|---|---|
| lavender | `#B785B8` | Brillos suaves del fondo, ondas de clic |
| mauve | `#A46EA4` | Acentos |
| mauve-dark | `#70436F` | Etiquetas pequeñas |
| mauve-deep | `#5B365B` | Fondo del cierre |
| beige | `#D8D4CB` | Detalles de la ventana |
| ivory | `#F5F1EB` | Fondo general |
| paper | `#FFFCF9` | Barra de la ventana |
| ink | `#3A2C36` | Títulos |
| eyebrow | `#815D7F` | Antetítulos |
| brown | `#8A694D` | — |

## Tipografía

- Títulos: Playfair Display (oficial).
- Textos: Poppins (oficial).

## Restricciones

- Sin datos reales: el catálogo, los pedidos y los clientes que aparecen son los datos de demostración (`npm run db:demo`), evidentemente ficticios.
- Sin datos sensibles: el correo de la cuenta, las instrucciones de pago configuradas (con número y titular) y los enlaces privados de seguimiento se difuminan durante la captura; la barra de dirección oculta el token de seguimiento.
- Sin funciones inexistentes: no hay cuentas de cliente, registro, ordenamiento del catálogo ni filtro por rango de precio (ver README).
