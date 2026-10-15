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
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '../../generated/prisma/client';
import { Public, Roles } from '../auth/auth.decorators';
import { SESSION_COOKIE } from '../auth/auth.types';
import {
  PublicStoreInfoDto,
  ShippingRateDto,
  StoreSettingsDto,
  UpdateStoreSettingsDto,
  UpsertShippingRateDto,
} from './store-settings.dto';
import { PublicStorePageDto, StoreContentDto, UpdateStoreContentDto } from './content.dto';
import { StoreSettingsService } from './store-settings.service';

/** El personal consulta la configuración; solo la propietaria la modifica (Context/decisiones.md). */
@ApiTags('Panel: configuración')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/settings')
export class StoreSettingsAdminController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get()
  @ApiOkResponse({ type: StoreSettingsDto })
  get(): Promise<StoreSettingsDto> {
    return this.settings.get();
  }

  @Patch()
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: StoreSettingsDto })
  update(@Body() dto: UpdateStoreSettingsDto): Promise<StoreSettingsDto> {
    return this.settings.update(dto);
  }

  @Get('shipping-rates')
  @ApiOkResponse({ type: [ShippingRateDto] })
  listShippingRates(): Promise<ShippingRateDto[]> {
    return this.settings.listShippingRates();
  }

  @Post('shipping-rates')
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: ShippingRateDto })
  upsertShippingRate(@Body() dto: UpsertShippingRateDto): Promise<ShippingRateDto> {
    return this.settings.upsertShippingRate(dto);
  }

  @Delete('shipping-rates/:id')
  @Roles(AdminRole.ADMIN)
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteShippingRate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.settings.deleteShippingRate(id);
  }
}

/** Contenido de la tienda: el personal lo consulta; solo la propietaria lo modifica. */
@ApiTags('Panel: contenido')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/content')
export class StoreContentAdminController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get()
  @ApiOkResponse({ type: StoreContentDto })
  get(): Promise<StoreContentDto> {
    return this.settings.getContent();
  }

  @Patch()
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: StoreContentDto })
  update(@Body() dto: UpdateStoreContentDto): Promise<StoreContentDto> {
    return this.settings.updateContent(dto);
  }
}

@ApiTags('Tienda')
@Public()
@Controller('store/content')
export class StoreContentController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get(':slug')
  @ApiOkResponse({ type: PublicStorePageDto })
  get(@Param('slug') slug: string): Promise<PublicStorePageDto> {
    return this.settings.getPage(slug);
  }
}

@ApiTags('Tienda')
@Public()
@Controller('store/info')
export class StoreInfoController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get()
  @ApiOkResponse({ type: PublicStoreInfoDto })
  get(): Promise<PublicStoreInfoDto> {
    return this.settings.getPublicInfo();
  }
}
