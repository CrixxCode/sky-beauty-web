import { Module } from '@nestjs/common';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { PricingService } from './pricing.service';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [StoreSettingsModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, PricingService],
  exports: [PricingService],
})
export class PromotionsModule {}
