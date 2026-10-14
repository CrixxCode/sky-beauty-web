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
import {
  CategoryDto,
  CreateCategoryDto,
  PublicCategoryDto,
  UpdateCategoryDto,
} from './categories.dto';
import { CategoriesService } from './categories.service';

@ApiTags('Panel: catálogo')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOkResponse({ type: CategoryDto, isArray: true })
  tree(): Promise<CategoryDto[]> {
    return this.categories.tree();
  }

  @Post()
  @ApiOkResponse({ type: CategoryDto })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CategoryDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  // Eliminar es exclusivo de la propietaria; el personal crea y edita (Context/decisiones.md).
  @Roles(AdminRole.ADMIN)
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}

@ApiTags('Tienda')
@Public()
@Controller('store/categories')
export class StoreCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOkResponse({ type: PublicCategoryDto, isArray: true })
  tree(): Promise<PublicCategoryDto[]> {
    return this.categories.publicTree();
  }
}
