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
} from '@nestjs/common';
import { AdminRole } from '../../../generated/prisma/client';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../../auth/auth.decorators';
import { SESSION_COOKIE } from '../../auth/auth.types';
import { BrandDto, CreateBrandDto, PublicBrandDto, UpdateBrandDto } from './brands.dto';
import { BrandsService } from './brands.service';

@ApiTags('Panel: catálogo')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @ApiOkResponse({ type: BrandDto, isArray: true })
  list(): Promise<BrandDto[]> {
    return this.brands.list();
  }

  @Post()
  @ApiOkResponse({ type: BrandDto })
  create(@Body() dto: CreateBrandDto): Promise<BrandDto> {
    return this.brands.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: BrandDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto): Promise<BrandDto> {
    return this.brands.update(id, dto);
  }

  @Delete(':id')
  // Eliminar es exclusivo de la propietaria; el personal crea y edita (Context/decisiones.md).
  @Roles(AdminRole.ADMIN)
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.brands.remove(id);
  }
}

@ApiTags('Tienda')
@Public()
@Controller('store/brands')
export class StoreBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @ApiOkResponse({ type: PublicBrandDto, isArray: true })
  list(): Promise<PublicBrandDto[]> {
    return this.brands.listPublic();
  }
}
