import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '../../generated/prisma/client';
import { CurrentAdmin, Roles } from '../auth/auth.decorators';
import { SESSION_COOKIE } from '../auth/auth.types';
import type { AuthenticatedAdmin } from '../auth/auth.types';
import {
  CreatePromotionDto,
  ListPromotionsQueryDto,
  PaginatedPromotionsDto,
  PromotionDto,
  PromotionRevisionDto,
  UpdatePromotionDto,
} from './promotions.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('Panel: promociones')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/promotions')
@Roles(AdminRole.ADMIN)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedPromotionsDto })
  list(@Query() query: ListPromotionsQueryDto): Promise<PaginatedPromotionsDto> {
    return this.promotions.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: PromotionDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PromotionDto> {
    return this.promotions.findOne(id);
  }

  @Get(':id/revisions')
  @ApiOkResponse({ type: PromotionRevisionDto, isArray: true })
  revisions(@Param('id', ParseUUIDPipe) id: string): Promise<PromotionRevisionDto[]> {
    return this.promotions.revisions(id);
  }

  @Post()
  @ApiOkResponse({ type: PromotionDto })
  create(
    @Body() dto: CreatePromotionDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<PromotionDto> {
    return this.promotions.create(dto, admin.id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PromotionDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<PromotionDto> {
    return this.promotions.update(id, dto, admin.id);
  }
}
