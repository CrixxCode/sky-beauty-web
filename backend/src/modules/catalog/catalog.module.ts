import { Module } from '@nestjs/common';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [BrandsModule, CategoriesModule, ProductsModule],
})
export class CatalogModule {}
