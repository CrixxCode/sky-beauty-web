# Copias de seguridad sin servicios adicionales

La persona usuaria confirmó el 2026-10-16 esta estrategia para minimizar el gasto:
copias **manuales una vez por semana y antes de cada despliegue**, conservando
las **dos últimas en su computador**. No se contrata almacenamiento externo
ni se deja un servicio de copias ejecutándose. La copia semanal debe incluir
tanto la base como las fotos; configurar un recordatorio personal y descargar
los tres archivos antes de dar la operación por terminada.

## Crear una copia

En el servicio backend, con `DATABASE_URL` y `UPLOADS_DIR` configuradas:

```sh
npm run backup:create -- /tmp/sky-beauty-copia-fecha
```

Usar una carpeta que no exista y que esté fuera de `UPLOADS_DIR`. Durante la
copia, coordinar con el personal para no agregar, reemplazar ni borrar fotos.
`pg_dump` toma una instantánea consistente de PostgreSQL; el archivo de fotos
se recoge por separado.

La carpeta contiene `database.dump`, `uploads.tar.gz` y `manifest.json` con
sumas SHA-256. Solo aparece el manifiesto cuando ambas operaciones terminan.
Si una falla, el comando devuelve error y la carpeta parcial no se considera
una copia válida.

Descargar la carpeta completa a un equipo controlado por la propietaria antes
de redesplegar: `/tmp` es temporal. No dejar la única copia junto a la base
original, no guardarla en `/uploads` (es público) y no subirla al repositorio.
Contiene datos de clientes y cuentas administrativas. Elegir almacenamiento
local protegido y revisar el espacio disponible.

La imagen incorpora clientes PostgreSQL 17. Para una base Railway de otra
versión, verificar compatibilidad; `pg_dump` no admite un servidor de versión
mayor que su propia versión.

## Probar una restauración

Crear una base PostgreSQL **vacía y aislada**, cuyo nombre termine en
`_restore`. Definir `RESTORE_DATABASE_URL` en el entorno de la herramienta,
sin imprimir credenciales ni ponerlas en la línea de comandos.

```sh
npm run backup:restore-check -- /tmp/sky-beauty-copia-fecha /tmp/sky-beauty-fotos-restauradas
```

La herramienta verifica los hashes, rechaza la base configurada como
`DATABASE_URL`, rechaza bases con tablas y exige una carpeta nueva para las
fotos. No usa `--clean`, no sobrescribe la base original y falla ante un error
de restauración. Solo usar archivos generados por esta herramienta y de origen
confiable.

Después comprobar recuentos de pedidos, productos, movimientos y fotos frente
a la copia; arrancar una instancia aislada contra los datos restaurados y
comprobar salud, catálogo, imágenes y seguimiento. Conservar evidencia de esta
prueba. La herramienta no cambia la conexión de la tienda ni promueve la copia
a producción.

## Recuperación de producción

Restaurar primero en una base y un directorio nuevos, verificar la aplicación,
y luego cambiar conexiones y rutas durante una intervención controlada.
No ejecutar suites de pruebas, seeds de demostración ni un reset de Prisma
sobre datos reales. Guardar la base y las fotos anteriores hasta confirmar
la recuperación. Mantener las dos últimas copias completas en el computador;
eliminar las anteriores solo después de verificar la nueva.
