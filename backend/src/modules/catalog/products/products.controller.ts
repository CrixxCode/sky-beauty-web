import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAdmin, Public } from '../../auth/auth.decorators';
import { SESSION_COOKIE } from '../../auth/auth.types';
import type { AuthenticatedAdmin } from '../../auth/auth.types';
import {
  ChangeProductStatusDto,
  CreateProductDto,
  CreateVariantDto,
  PaginatedProductsDto,
  PaginatedPublicProductsDto,
  ProductDto,
  ListProductsQueryDto,
  PublicListProductsQueryDto,
  PublicProductDto,
  UpdateProductDto,
  UpdateVariantDto,
  VariantDto,
} from './products.dto';
import { ProductsService } from './products.service';

@ApiTags('Panel: catálogo')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedProductsDto })
  list(
    @Query() query: ListProductsQueryDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<PaginatedProductsDto> {
    return this.products.list(query, admin.role);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<ProductDto> {
    return this.products.findOne(id, admin.role);
  }

  @Post()
  @ApiOkResponse({ type: ProductDto })
  create(
    @Body() dto: CreateProductDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<ProductDto> {
    return this.products.create(dto, admin.id, admin.role);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ProductDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<ProductDto> {
    return this.products.update(id, dto, admin.id, admin.role);
  }

  @Patch(':id/status')
  @ApiOkResponse({ type: ProductDto })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeProductStatusDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<ProductDto> {
    return this.products.changeStatus(id, dto, admin.id, admin.role);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.products.remove(id);
  }

  @Post(':productId/variants')
  @ApiOkResponse({ type: VariantDto })
  createVariant(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateVariantDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<VariantDto> {
    return this.products.createVariant(productId, dto, admin.id, admin.role);
  }

  @Patch(':productId/variants/:id')
  @ApiOkResponse({ type: VariantDto })
  updateVariant(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<VariantDto> {
    return this.products.updateVariant(productId, id, dto, admin.id, admin.role);
  }

  @Delete(':productId/variants/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeVariant(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.products.removeVariant(productId, id);
  }
}

@ApiTags('Tienda')
@Public()
@Controller('store/products')
export class StoreProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedPublicProductsDto })
  listPublic(@Query() query: PublicListProductsQueryDto): Promise<PaginatedPublicProductsDto> {
    return this.products.listPublic(query);
  }

  @Get(':slug')
  @ApiOkResponse({ type: PublicProductDto })
  findOnePublic(@Param('slug') slug: string): Promise<PublicProductDto> {
    return this.products.findOnePublicBySlug(slug);
  }
}
