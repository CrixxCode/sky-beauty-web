import { Module } from '@nestjs/common';
import { PromotionsModule } from '../../promotions/promotions.module';
import { StoreSettingsModule } from '../../store-settings/store-settings.module';
import { AdminProductsController, StoreProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [StoreSettingsModule, PromotionsModule],
  controllers: [AdminProductsController, StoreProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
