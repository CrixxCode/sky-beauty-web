import { Module } from '@nestjs/common';
import { PromotionsModule } from '../promotions/promotions.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { AdminOrdersController, StoreOrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PromotionsModule, StoreSettingsModule],
  controllers: [StoreOrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
