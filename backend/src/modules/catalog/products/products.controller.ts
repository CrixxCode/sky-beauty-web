import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiCookieAuth,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Env } from '../../../config/env';
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
  ImageDto,
  ListProductsQueryDto,
  PublicListProductsQueryDto,
  PublicProductDto,
  UpdateProductDto,
  UploadProductImageDto,
  UpdateVariantDto,
  VariantDto,
} from './products.dto';
import { ProductsService } from './products.service';

@ApiTags('Panel: catálogo')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  @ApiOkResponse({ type: PaginatedProductsDto })
  list(@Query() query: ListProductsQueryDto): Promise<PaginatedProductsDto> {
    return this.products.list(query);
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
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.products.remove(id);
  }

  @Post(':productId/images')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: ImageDto })
  uploadImage(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UploadProductImageDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 1024 * 1024 * 10,
            message: 'La imagen supera el tamaño máximo permitido.',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<ImageDto> {
    return this.products.uploadImage(
      productId,
      dto,
      file,
      this.config.get('MAX_IMAGE_SIZE_MB', { infer: true }),
    );
  }

  @Delete(':productId/images/:imageId')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeImage(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.products.removeImage(productId, imageId);
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
