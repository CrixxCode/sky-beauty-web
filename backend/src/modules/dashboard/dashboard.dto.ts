import { ApiProperty } from '@nestjs/swagger';

/** Pendientes del día que ve todo el panel (propietaria y personal). */
export class DashboardPendingDto {
  @ApiProperty({ description: 'Pedidos registrados sin confirmar.' }) ordersToConfirm!: number;
  @ApiProperty({ description: 'Pagos con comprobante recibido, por verificar.' })
  paymentsToVerify!: number;
  @ApiProperty({ description: 'Avisos de cancelación por enviar al cliente.' })
  noticesToSend!: number;
  @ApiProperty({ description: 'Variantes en o por debajo de su umbral de stock bajo.' })
  lowStockVariants!: number;
}
