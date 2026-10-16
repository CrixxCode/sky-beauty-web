# Preparación del despliegue — 2026-10-16

Rama `dev`. Se preparó el repositorio para construir y validar los dos servicios
en Railway. No se publicó la tienda ni se modificó una base de producción.
Los resultados de QA del 15 de octubre se conservan como evidencia histórica.

## Cambios y decisiones confirmadas en esta conversación

- **Q-04 / BE-170:** un monto menor se registra como pago incompleto y rechazado;
  abre el plazo existente de aclaración de 8 horas. Un monto mayor exige una nota,
  registra el excedente por devolver y aplica al pedido solo su total. El excedente
  queda expresamente documentado para su devolución manual; no se incorpora
  como ingreso adicional del pedido ni se crea una gestión automática de excedentes.
- **Q-04 / BE-172:** solo se aceptan devoluciones totales del monto verificado.
  El formulario presenta ese monto como solo lectura, incluso si luego disminuyó
  el costo del envío.
- **Q-21 / BE-149:** no se permite aumentar el envío mientras el pedido esté pagado.
  El backend lo rechaza y el panel bloquea el guardado y explica el motivo.
- **Q-12:** autorizado GitHub Actions gratuito. Se agregó el flujo `QA` sin
  despliegue automático y sin credenciales reales en el workflow.
- **Textos legales:** la persona usuaria confirmó su aprobación y carga en la
  base. Se verificaron los cuatro textos en la base local y que no contienen
  marcadores `[PENDIENTE]`. Esto no demuestra que estén en otra base de Railway.
- **Copias:** confirmado hacerlas manualmente cada semana y antes de desplegar,
  conservando las dos últimas en el computador de la persona usuaria. Sin servicio
  adicional, programación periódica ni borrado automático de copias.

Estas confirmaciones ya están registradas en `Context/decisiones.md` (entradas
del 2026-10-16). El estado actual de lo que falta para abrir ventas está en
[`PENDIENTES_LANZAMIENTO.md`](PENDIENTES_LANZAMIENTO.md).

## Correcciones técnicas

- Prisma, cliente y adaptador PostgreSQL pasan de 7.10.0 a 7.10.1; desaparece
  el hallazgo alto de `deepmerge-ts` en la auditoría de producción.
- Se repararon ambos lockfiles para una instalación limpia en Linux; faltaban
  dependencias opcionales `@emnapi/core` y `@emnapi/runtime`.
- Se fijó `rootDir=src` y el alcance de compilación del backend. Los scripts de
  pruebas y carga no cambian la ubicación de `dist/main.js`; el arnés de navegador
  deja de poder arrancar un archivo antiguo por un cambio de raíz de compilación.
- El generador Prisma declara `importFileExtension=js` y recibe el tsconfig antes
  de generar. La primera imagen reveló que, sin ese contexto, generaba referencias
  `.ts` que impedían arrancar el JavaScript compilado; la imagen corregida arrancó.
- Todos los scripts que preparan o alteran la base de pruebas validan el nombre
  PostgreSQL con sufijo exacto `_test`; el control es compartido con Playwright.
- Dockerfiles, exclusión de secretos y artefactos locales, comandos de arranque,
  migraciones previas y healthchecks están preparados.
- Ofertas: se evita leer el historial cuando ya se tiene el precio actual; los
  destinos de promociones se agrupan y los cálculos equivalentes se reutilizan
  **solo dentro de la petición**. El historial de pedidos no cambia y no se añade
  caché de precios o existencias entre peticiones.

## Verificaciones ejecutadas

| Verificación                             | Resultado                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint y tipos backend                     | Aprobados                                                                                                                                                                                               |
| Lint y tipos frontend                    | Aprobados; seis advertencias preexistentes de imágenes y React Hook Form                                                                                                                                |
| Unitarias backend                        | 60 aprobadas, incluidas equivalencia del cálculo agrupado y protección de bases                                                                                                                         |
| Unitarias frontend                       | 57 aprobadas                                                                                                                                                                                            |
| Integración backend                      | Corrida de 188 casos: 187 aprobados y una expectativa de prueba corregida de 400 a 403; reejecución de pagos 12/12 aprobados. Después, catálogo y promociones 34/34 aprobados con la optimización final |
| Playwright                               | Corrida de 40 casos: 38 aprobados y dos fallas por etiqueta ambigua en la prueba ampliada de pagos; etiqueta aclarada y pagos 2/2 aprobados. Catálogo, inicio y promociones repetidos: 6/6 aprobados    |
| Auditoría de producción, ambos proyectos | Cero vulnerabilidades (`npm audit --omit=dev`)                                                                                                                                                          |
| Instalación y compilación Docker Linux   | Ambas imágenes construidas correctamente                                                                                                                                                                |
| Arranque en modo producción              | Backend y frontend activos; salud directa y por proxy: 200 con base disponible                                                                                                                          |
| Catálogo y archivos estáticos por proxy  | 200; logotipo y archivo del volumen accesibles                                                                                                                                                          |
| Seed y acceso en la imagen backend       | Seed idempotente; propietaria ficticia de prueba inicia sesión con cookie Secure, HttpOnly y SameSite=Lax                                                                                               |
| Migraciones desde la imagen backend      | `prisma migrate deploy` aprobado; 18 migraciones, ninguna pendiente                                                                                                                                     |
| Persistencia                             | Archivo conservado al reemplazar el contenedor backend, con el mismo SHA-256                                                                                                                            |
| Copia y restauración                     | 32 tablas restauradas; coinciden 2.000 productos, 6.000 variantes, 6.000 movimientos y 30 promociones. Coincide el hash del archivo restaurado                                                          |
| Protección de las copias                 | Se rechaza sobrescribir una copia y restaurar sobre una base no vacía                                                                                                                                   |

La prueba de restauración se hizo en `sky_beauty_deploy_restore`; la carga usó
`sky_beauty_deploy_test`. Los datos fueron exclusivamente ficticios. La base
local de la tienda se consultó para verificar los textos, sin modificarla.

La auditoría completa con dependencias de desarrollo conserva avisos en
herramientas de Jest y de generación/lint (incluido `braces`, sin versión
corregida publicada al revisar). No forman parte de las dependencias de
producción del frontend ni se resolvieron degradando Next.js o Jest.
Durante Playwright se observaron mensajes `The destination stream closed early`
en navegaciones interrumpidas de Next.js; no impidieron los casos aprobados.
Revisar los logs del entorno real durante la aceptación final.

## Rendimiento y alcance del cierre

Medición local Docker, backend en producción con `LOG_LEVEL=warn`, PostgreSQL 17,
2.000 productos activos, 6.000 variantes y 30 promociones de categoría.
Una sola instancia, sin servicios adicionales. Cada ejecución dura 60 segundos;
no es una medición del servidor de Railway.

Antes de la optimización final, búsqueda y ofertas con 20 conexiones dieron
p95 de 2.521 ms; con 5 conexiones, 794 ms. Después de quitar la consulta redundante
de historial, p95 fue 2.097 ms. Los resultados finales se guardan en los JSON
adyacentes:

| Caso                       | Conexiones | Peticiones/s |      p95 | Errores | Meta inicial confirmada por la persona usuaria |
| -------------------------- | ---------: | -----------: | -------: | ------: | ---------------------------------------------- |
| BE-228, búsqueda y ofertas |         20 |         27,4 | 1.099 ms |       0 | ≤ 1.500 ms                                     |
| BE-227, catálogo           |         50 |         83,5 |   718 ms |       0 | ≤ 1.000 ms                                     |

Evidencia: [búsqueda/ofertas](RENDIMIENTO_OFERTAS_2026-10-16.json) y
[catálogo](RENDIMIENTO_CATALOGO_2026-10-16.json). La persona usuaria confirmó
estas metas el 2026-10-16 para el inicio económico del emprendimiento, sujetas
a comprobarlas en Railway. Sustituyen las propuestas anteriores de 1.000 ms
y 500 ms para esta aceptación inicial. **D-04 cumple localmente las metas
confirmadas; su aceptación en Railway sigue pendiente.**

## Pendiente para desplegar y abrir ventas

1. Enlazar el proyecto y los servicios reales de Railway: la CLI local no está
   vinculada a un proyecto. Configurar dominio, variables y volumen de fotos
   según [la guía de despliegue](../deployment/RAILWAY.md).
2. Subir el commit revisado y obtener la primera ejecución verde de GitHub Actions.
   Se verificaron las herramientas localmente; no se ejecutó el workflow remoto.
3. Comprobar que la base de Railway contiene los textos aprobados y la configuración
   comercial real; desplegar código no migra los datos locales.
4. Repetir salud, compra, permisos, seguimiento, persistencia y rendimiento en
   Railway, y dar la aceptación final. La audiencia de unos 147 seguidores no
   define por sí sola una carga simultánea ni un presupuesto de CPU/RAM.
5. Ejecutar y descargar la primera copia real con el procedimiento acordado.

No se declara terminado el QA completo de lanzamiento: quedan la aceptación en
Railway y las verificaciones manuales/parciales del plan que estas suites no
sustituyen. Guías: [Railway](../deployment/RAILWAY.md) y [copias](../deployment/BACKUPS.md).
