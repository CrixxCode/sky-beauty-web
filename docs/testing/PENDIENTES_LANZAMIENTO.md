# Pendientes antes del lanzamiento

Estado al 2026-10-15, después de corregir los defectos de la ejecución de QA ([`PRUEBAS_FALLIDAS_2026-10-15.md`](PRUEBAS_FALLIDAS_2026-10-15.md)). Reúne lo que no depende del código: decisiones de la propietaria, datos reales y aceptaciones. Las preguntas Q-xx están en [`PLAN_MAESTRO_QA.md`](PLAN_MAESTRO_QA.md) (§H) y las decisiones vigentes, en [`Context/decisiones.md`](../../Context/decisiones.md).

## 1. Bloquean el lanzamiento

| # | Qué falta | Quién | Por qué bloquea | Referencia |
|---|---|---|---|---|
| 1 | **Aprobar los textos legales**: términos, tratamiento de datos, cambios y garantías, y envíos. Hoy son borradores: hay que completar los `[PENDIENTE: ...]`, validarlos con asesoría legal y confirmar los plazos que se propusieron | Propietaria y asesoría legal | El plan no permite el primer lanzamiento sin ellos; el checkout pide aceptarlos | H-19, FE-061, E2E-018, `Context/politicas/` |
| 2 | **Montos que no coinciden y devoluciones parciales**: qué hacer si el pago verificado es distinto del total y cómo se registra una devolución parcial | Propietaria | Requisito del plan para desplegar. Hoy se acepta un monto distinto sin advertencia, y una devolución parcial deja el pago como devuelto | Q-04, recomendación en `PLAN_PRUEBAS_BACKEND.md` §D.3 |
| 3 | **Envío que sube después del pago**: ¿el pedido sigue pagado o queda una diferencia por cobrar? | Propietaria | Hoy queda como pagado con un total mayor al pagado | Q-21 |
| 4 | **Volumen esperado**: cuántos productos y visitantes simultáneos, y qué tiempos de respuesta son aceptables | Propietaria | Sin metas no se puede aprobar el rendimiento. Con 50 conexiones simultáneas, el catálogo responde en 743 ms (p95), por encima de los 500 ms propuestos | Q-15, D-04 |
| 5 | **Copias de seguridad** de la base de datos y de las fotos, con una restauración probada | Propietaria y desarrollo | Sin ellas, una falla del servidor pierde pedidos y fotos | R-07, `decisiones.md` "Infraestructura sin servicios de pago" |
| 6 | **Gasto en Railway**: confirmar que el volumen persistente de las fotos y, si se usa, un entorno de validación (*staging*) entran en el gasto permitido | Propietaria | La validación previa a producción se hace sobre un entorno desplegado | Q-14, `PLAN_MAESTRO_QA.md` §E.2 |
| 7 | **Aceptación final**: quién hace las pruebas manuales en el entorno desplegado y quién da el visto bueno | Propietaria | Cierra la fase 8 del plan | Q-16 |
| 8 | **Vulnerabilidad pendiente** (BE-226): `deepmerge-ts`, alta, en la CLI de Prisma. Se corrige con Prisma 7.10.1, publicado el 2026-10-15. Se recomienda esperar unas semanas a que madure y actualizar, o aceptarla por escrito: solo la usa la CLI al leer la configuración propia del proyecto y no recibe datos de clientes | Desarrollo | El plan pide cero hallazgos altos abiertos o aceptados por escrito | BE-226 |
| 9 | **Integración continua**: ¿se puede usar GitHub Actions en su plan gratuito? Si no, las pruebas se corren a mano antes de cada despliegue | Propietaria | El plan pide que las pruebas pasen en CI sobre el commit que se despliega | Q-12, H-16 |

## 2. Datos reales para cargar en el panel antes de abrir

No requieren cambios de código: se configuran en el panel. Sin ellos la tienda funciona, pero incompleta.

- Número comercial de WhatsApp, correo y teléfono de contacto, dirección, horario y redes sociales.
- Métodos de pago con sus instrucciones reales (cuentas de transferencia, Nequi, Daviplata).
- Contra entrega: municipios donde se ofrece y monto máximo.
- Envíos: tarifas por municipio y, si aplica, monto mínimo para envío gratis.
- Cifras comerciales:
  - límite del descuento porcentual;
  - tope general de unidades por producto;
  - umbral de stock bajo que se propone por defecto.
- Catálogo real: marcas, categorías, productos, precios, costos de compra, existencias iniciales y fotografías autorizadas.
- Si se publican testimonios: cómo se registra la autorización de cada clienta para publicar su nombre e inicial (Ley 1581 de 2012).

## 3. Conviene decidir antes, pero no bloquea

| Pregunta | Situación actual | Referencia |
|---|---|---|
| Un pedido "en preparación" sin comprobante a las 24 h, ¿también se cancela automáticamente? | El código lo cancela; la decisión habla solo de pedidos confirmados | Q-19 |
| ¿El enlace de un producto debe mantenerse al renombrarlo? | Al renombrarlo cambia el enlace y los compartidos quedan rotos | Q-07 |
| ¿Se puede publicar un producto sin variantes activas? ¿Qué cambios de estado se permiten? | Se permite todo, incluso pasar de archivado a activo | Q-18, Q-08 |
| ¿Se ocultan los productos de una categoría o marca inactiva? | Siguen visibles en el listado y por enlace directo | Q-09 |
| ¿Qué navegadores y versiones mínimas se soportan? | Probado en Chromium (celular y escritorio) | Q-20 |

## 4. Puede esperar

- Q-06: registrar el comprobante antes de confirmar el pedido.
- Q-10: el bloqueo del panel por intentos fallidos.
- Q-11: sincronizar la bolsa entre pestañas.
- Q-13: herramientas de prueba como dependencias del repositorio.
- Q-17: el token de seguimiento en los registros.
- Información adicional del producto.
- Logotipo monocromo.
