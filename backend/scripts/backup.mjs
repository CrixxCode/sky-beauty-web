import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

// Herramienta manual: la frecuencia, retención y destino externo los define la propietaria.
// No envía datos a servicios externos ni elimina copias antiguas.
function run(command, args, databaseUrl) {
  const url = databaseUrl ? new URL(databaseUrl) : undefined;
  url?.searchParams.delete('schema');
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(url && {
        PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
        PGHOST: url.hostname,
        PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        ...(url.searchParams.has('sslmode') && { PGSSLMODE: url.searchParams.get('sslmode') }),
      }),
    },
  });
  if (result.error || result.status !== 0)
    throw new Error(`Falló ${command}; no se completó la operación.`);
}

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function backup(destination) {
  if (!process.env.DATABASE_URL || !process.env.UPLOADS_DIR || !destination) {
    throw new Error('Define DATABASE_URL, UPLOADS_DIR y una carpeta nueva de destino.');
  }
  const uploads = await realpath(process.env.UPLOADS_DIR);
  const target = path.resolve(destination);
  const relative = path.relative(uploads, target);
  if (
    !relative ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  ) {
    throw new Error('La copia debe guardarse fuera de UPLOADS_DIR.');
  }
  await mkdir(target, { mode: 0o700 }); // Falla si ya existe; nunca sobrescribe una copia.
  const databaseFile = path.join(target, 'database.dump');
  const uploadsFile = path.join(target, 'uploads.tar.gz');
  run(
    'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl', '--file', databaseFile],
    process.env.DATABASE_URL,
  );
  run('tar', ['-czf', uploadsFile, '-C', uploads, '.']);
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    files: {
      'database.dump': await sha256(databaseFile),
      'uploads.tar.gz': await sha256(uploadsFile),
    },
  };
  await writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2), {
    mode: 0o600,
    flag: 'wx',
  });
  console.log('Copia completada y verificada:', target);
}

async function restoreCheck(source, destination) {
  const restoreUrl = process.env.RESTORE_DATABASE_URL;
  if (!restoreUrl || !source || !destination) {
    throw new Error(
      'Define RESTORE_DATABASE_URL y pasa la copia y una carpeta nueva para las fotos restauradas.',
    );
  }
  const url = new URL(restoreUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !name.endsWith('_restore')) {
    throw new Error(
      'La restauración de prueba exige una base PostgreSQL vacía cuyo nombre termine en _restore.',
    );
  }
  if (process.env.DATABASE_URL) {
    const live = new URL(process.env.DATABASE_URL);
    if (
      live.hostname === url.hostname &&
      live.port === url.port &&
      live.pathname === url.pathname
    ) {
      throw new Error('La base de restauración no puede ser DATABASE_URL.');
    }
  }
  const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1) throw new Error('Formato de copia no reconocido.');
  for (const name of ['database.dump', 'uploads.tar.gz']) {
    if ((await sha256(path.join(source, name))) !== manifest.files[name]) {
      throw new Error(`La integridad de ${name} no coincide con el manifiesto.`);
    }
  }
  url.searchParams.delete('schema');
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const result = await client.query(
      "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')",
    );
    if (result.rows[0].count !== 0)
      throw new Error('La base de restauración no está vacía. No se modificó.');
    const target = path.resolve(destination);
    await mkdir(target, { mode: 0o700 });
    run(
      'pg_restore',
      [
        '--no-owner',
        '--no-acl',
        '--exit-on-error',
        '--dbname',
        name,
        path.join(source, 'database.dump'),
      ],
      restoreUrl,
    );
    run('tar', ['-xzf', path.join(source, 'uploads.tar.gz'), '-C', target]);
    const tables = await client.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    if (tables.rows[0].count === 0) throw new Error('La restauración no contiene tablas.');
    console.log(
      'Restauración de prueba completada:',
      tables.rows[0].count,
      'tablas. Fotos:',
      target,
    );
  } finally {
    await client.end();
  }
}

try {
  const [mode, first, second] = process.argv.slice(2);
  if (mode === 'create') await backup(first);
  else if (mode === 'restore-check') await restoreCheck(first, second);
  else
    throw new Error(
      'Uso: node scripts/backup.mjs create <carpeta-nueva> | restore-check <copia> <carpeta-nueva-fotos>',
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se completó la operación.');
  process.exitCode = 1;
}
