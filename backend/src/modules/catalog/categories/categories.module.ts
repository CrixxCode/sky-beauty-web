import { Module } from '@nestjs/common';
import { AdminCategoriesController, StoreCategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [AdminCategoriesController, StoreCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
