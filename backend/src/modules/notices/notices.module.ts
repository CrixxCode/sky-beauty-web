import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminNoticesController, AdminNotificationsController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({
  imports: [OrdersModule],
  controllers: [AdminNoticesController, AdminNotificationsController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
