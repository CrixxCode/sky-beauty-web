/**
 * Procesa una vez los plazos de los pedidos: avisos "se cancelará en 1 hora" y cancelaciones
 * automáticas (ver Context/decisiones.md). El backend ya lo hace cada minuto; este comando sirve
 * para ejecutarlo a mano en el servidor (por ejemplo, desde la consola de Railway).
 *
 * Uso: npm run orders:run-deadlines
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NoticesService } from '../modules/notices/notices.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const result = await app.get(NoticesService).runLocked(new Date());
    console.log(
      result
        ? `Avisos creados: ${result.beforeCreated}. Pedidos cancelados: ${result.cancelled}. Avisos cerrados: ${result.closed}.`
        : 'Otra instancia está procesando los plazos en este momento.',
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
