# sky-beauty-web

Tienda y panel de Sky Beauty Maquillaje. Backend NestJS + Prisma + PostgreSQL;
frontend Next.js. Las reglas de negocio están en [Context/](Context/).

- [Preparación y despliegue en Railway](docs/deployment/RAILWAY.md).
- [Copias y restauración de prueba](docs/deployment/BACKUPS.md).
- [Planes y resultados de QA](docs/testing/PLAN_MAESTRO_QA.md).

Desarrollo local: copiar `.env.example` a `.env` en la raíz,
`backend/.env.example` a `backend/.env` y `frontend/.env.example` a
`frontend/.env.local`, y completar los secretos. Las claves internas de ambas
aplicaciones deben coincidir. Ejecutar `docker compose up -d postgres`, `npm ci`
en cada aplicación, las migraciones y `npm run db:seed` en `backend/`.
Arrancar con `npm run start:dev` en `backend/` y `npm run dev` en `frontend/`.

Para probar las imágenes de producción localmente:
`docker compose --profile full up --build`. Este perfil aplica migraciones a la
base local configurada; no debe apuntarse a una base de producción.
Las pruebas de backend y Playwright usan la misma base `*_test`: ejecutarlas
en secuencia, nunca simultáneamente.
