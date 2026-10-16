# Pendientes antes del lanzamiento

Estado al 2026-10-16. Reúne lo que falta para abrir ventas. Las decisiones de negocio vigentes están en [`Context/decisiones.md`](../../Context/decisiones.md); el detalle técnico de la preparación, en [`PREPARACION_DESPLIEGUE_2026-10-16.md`](PREPARACION_DESPLIEGUE_2026-10-16.md), y las guías, en [Railway](../deployment/RAILWAY.md) y [copias](../deployment/BACKUPS.md).

## Estado del código

- Rama `main` y `dev` en el mismo commit; el flujo `QA` de GitHub Actions está en verde en ambas (lint, tipos, unitarias, integración, Playwright, auditoría de dependencias de producción, construcción de las imágenes y arranque de producción por proxy).
- No hay defectos de código abiertos del plan de QA. Las preguntas Q-04, Q-07, Q-09, Q-12, Q-14, Q-16, Q-18, Q-19 y Q-21 están resueltas y registradas.

## 1. Bloquean abrir ventas

Nada de esto depende de cambios de código. Es el despliegue y lo que se decide o se carga fuera del repositorio.

| # | Qué falta | Quién | Referencia |
|---|---|---|---|
| 1 | ~~Gasto del volumen de fotos en Railway.~~ **Resuelto:** plan Hobby y volumen aprobados (ver sección 3). Falta crear el volumen en el servicio backend (punto 3) | — | `decisiones.md` "Volumen de fotos y plan de Railway" |
| 2 | **Comprar el dominio** y configurarlo con HTTPS | Propietaria | `plan-desarrollo.md` módulo 14 |
| 3 | **Montar Railway**: enlazar el proyecto, crear los servicios `backend` y `frontend`, cargar las variables, montar el volumen en `/app/uploads`, una sola instancia del backend sin suspensión automática | Desarrollo | `RAILWAY.md` |
| 4 | **Primer arranque**: `npm run db:seed` con `SEED_OWNER_*` y luego borrar `SEED_OWNER_PASSWORD`. No ejecutar `db:demo` | Desarrollo | `RAILWAY.md` |
| 5 | **Cargar los textos legales aprobados en la base de Railway.** Están en la base local; el despliegue no copia datos | Propietaria | `decisiones.md` "Textos legales aprobados" |
| 6 | **Datos reales en el panel** (sección 2) | Propietaria | — |
| 7 | **Validación en producción** con datos ficticios evidentes, que se borran antes de abrir (lista de abajo) | Desarrollo | `PLAN_MAESTRO_QA.md` §E.2 |
| 8 | **Metas de rendimiento en Railway**: p95 ≤ 1,5 s en búsqueda y ofertas con 20 conexiones y ≤ 1 s en catálogo con 50 conexiones. Se cumplieron solo en local | Desarrollo | `RAILWAY.md` "Medición reproducible" |
| 9 | **Primera copia real** (base y fotos), descargada, y su restauración probada en una base aislada | Desarrollo | `BACKUPS.md` |
| 10 | **Visto bueno de la propietaria**, con un pedido de prueba enviado por WhatsApp desde su celular | Propietaria | `decisiones.md` |

### Lista de la validación en producción (punto 7)

1. Los dos servicios responden a su healthcheck y los logs no muestran errores. Revisar en especial los mensajes `The destination stream closed early` que aparecieron en Playwright.
2. Inicio, catálogo, fotos, favoritos y acceso al panel con HTTPS.
3. `TRUST_PROXY_HOPS`: dos conexiones distintas no comparten el límite de intentos.
4. Una foto subida sigue disponible después de redesplegar el backend.
5. Los cuatro textos legales se ven, enlazados desde el pie y desde las casillas del checkout.
6. Compra de punta a punta desde el celular, con seguimiento y WhatsApp; gestión del pedido en el panel (confirmar, comprobante, verificar, despachar, entregar) y su cancelación.
7. Permisos: el personal no ve lo exclusivo de la propietaria.
8. El ciclo de plazos corre en una sola instancia (logs "Ciclo de plazos de pedidos").
9. No quedan datos de demostración ni de prueba.

## 2. Datos reales para cargar en el panel

No requieren cambios de código. Sin ellos la tienda funciona, pero incompleta.

- Número comercial de WhatsApp, correo y teléfono de contacto, dirección, horario y redes sociales.
- Métodos de pago con sus instrucciones reales (cuentas de transferencia, Nequi, Daviplata).
- Contra entrega: municipios donde se ofrece y monto máximo.
- Envíos: tarifas por municipio y, si aplica, monto mínimo para envío gratis.
- Cifras comerciales: límite del descuento porcentual, tope general de unidades por producto y umbral de stock bajo por defecto.
- Catálogo real: marcas, categorías, productos, precios, costos de compra, existencias iniciales y fotografías autorizadas.
- Si se publican testimonios: cómo se registra la autorización de cada clienta para publicar su nombre e inicial (Ley 1581 de 2012).

## 3. Resuelto

| Pendiente anterior | Cómo quedó |
|---|---|
| Textos legales (H-19) | Aprobados por la propietaria y cargados en la base local, **sin revisión legal** (riesgo asumido por la propietaria). Falta cargarlos en Railway (punto 5) |
| Montos distintos y devoluciones parciales (Q-04) | Monto menor: pago incompleto con 8 horas para aclarar. Monto mayor: pagado por el total con nota del excedente. Solo devoluciones totales |
| Envío que sube después del pago (Q-21) | No se puede subir mientras el pedido esté pagado |
| Volumen y rendimiento (Q-15, D-04) | Metas iniciales confirmadas; cumplidas en local, pendientes en Railway (punto 8) |
| Copias de seguridad (R-07) | Manuales, semanales y antes de cada despliegue, con las dos últimas en el computador. Falta la primera copia real (punto 9) |
| Gasto del volumen de fotos | Plan Hobby de Railway y volumen aprobados. A 0,15 USD por GB al mes, un catálogo de cientos de productos ocupa menos de 1 GB |
| Entorno de pruebas (Q-14) | Sin segundo entorno: se valida en producción antes de abrir |
| Aceptación final (Q-16) | Desarrollo prueba; la propietaria aprueba |
| Vulnerabilidad de Prisma (BE-226) | Prisma 7.10.1; cero hallazgos en dependencias de producción |
| Integración continua (Q-12) | GitHub Actions gratuito; en verde en `dev` y `main` |
| Pedido en preparación sin comprobante (Q-19) | Se cancela a las 24 horas, como hoy |
| Enlace del producto al renombrarlo (Q-07) | Se mantiene |
| Producto sin variantes activas (Q-18) | No se puede publicar |
| Categoría o marca inactiva (Q-09) | Sus productos se ocultan de la tienda |

## 4. Conviene decidir, pero no bloquea

| Pregunta | Situación actual | Referencia |
|---|---|---|
| ¿Qué cambios de estado del producto se permiten? | Se permite todo, incluso pasar de archivado a activo | Q-08 |
| ¿Qué navegadores y versiones mínimas se soportan? | Probado en Chromium (celular y escritorio); la ejecución de QA también pasó en Firefox y WebKit | Q-20 |
| Si a un producto publicado se le desactivan o eliminan todas las variantes, ¿se despublica solo? | Q-18 solo cubre el momento de publicar; después queda publicado sin variantes activas y no se puede comprar | Q-18 |
| Las páginas legales sin texto: ¿404 y fuera del pie, o visibles con "Esta información estará disponible pronto"? | `plan-desarrollo.md` dice lo primero; el código hace lo segundo. Deja de importar cuando los cuatro textos estén cargados | `RESULTADOS_EJECUCION_2026-10-15.md` §4 |
| Los plazos propuestos en las políticas (reporte en 48 h, cambios en 5 días hábiles, reembolso en 15, mayoría de edad, nuevo envío si falla por datos incorrectos) | Quedan los que tengan los textos aprobados; `decisiones.md` no los confirma uno a uno | `decisiones.md` "Políticas y términos para clientes" |

## 5. Puede esperar

- Q-06: registrar el comprobante antes de confirmar el pedido.
- Q-10: el bloqueo del panel por intentos fallidos revela que el correo existe.
- Q-11: sincronizar la bolsa entre pestañas.
- Q-13: herramientas de pruebas de accesibilidad y carga como dependencias del repositorio.
- Q-17: el token de seguimiento queda en los registros de acceso.
- Imagen de vista previa general para redes (necesita el logotipo en PNG; hoy el inicio no tiene `og:image`).
- Logotipo monocromo.
- Información adicional del producto.
- Vulnerabilidades solo en herramientas de desarrollo (Jest, lint, generación), sin versión corregida publicada al revisar.
