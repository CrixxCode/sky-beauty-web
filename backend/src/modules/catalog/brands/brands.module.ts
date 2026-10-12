import { Module } from '@nestjs/common';
import { AdminBrandsController, StoreBrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  controllers: [AdminBrandsController, StoreBrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
