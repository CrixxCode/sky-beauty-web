import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SESSION_COOKIE } from '../auth/auth.types';
import { CurrentAdmin } from '../auth/auth.decorators';
import type { AuthenticatedAdmin } from '../auth/auth.types';
import {
  CreateInventoryMovementDto,
  InventoryMovementDto,
  InventoryVariantDto,
  ListInventoryMovementsQueryDto,
  ListInventoryQueryDto,
  PaginatedInventoryMovementsDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Panel: inventario')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('variants')
  @ApiOkResponse({ type: InventoryVariantDto, isArray: true })
  listVariants(@Query() query: ListInventoryQueryDto): Promise<InventoryVariantDto[]> {
    return this.inventory.listVariants(query);
  }

  @Get('movements')
  @ApiOkResponse({ type: PaginatedInventoryMovementsDto })
  listMovements(
    @Query() query: ListInventoryMovementsQueryDto,
  ): Promise<PaginatedInventoryMovementsDto> {
    return this.inventory.listMovements(query);
  }

  @Post('movements')
  @ApiOkResponse({ type: InventoryMovementDto })
  createMovement(
    @Body() dto: CreateInventoryMovementDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<InventoryMovementDto> {
    return this.inventory.createMovement(dto, admin.id);
  }
}
