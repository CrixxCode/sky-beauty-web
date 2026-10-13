import { Module } from '@nestjs/common';
import {
  StoreContentAdminController,
  StoreContentController,
  StoreInfoController,
  StoreSettingsAdminController,
} from './store-settings.controller';
import { StoreSettingsService } from './store-settings.service';

@Module({
  controllers: [
    StoreSettingsAdminController,
    StoreInfoController,
    StoreContentAdminController,
    StoreContentController,
  ],
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
