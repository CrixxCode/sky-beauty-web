import { Module } from '@nestjs/common';
import { StoreInfoController, StoreSettingsAdminController } from './store-settings.controller';
import { StoreSettingsService } from './store-settings.service';

@Module({
  controllers: [StoreSettingsAdminController, StoreInfoController],
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
