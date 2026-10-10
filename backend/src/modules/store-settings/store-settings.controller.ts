import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '../../generated/prisma/client';
import { Public, Roles } from '../auth/auth.decorators';
import { SESSION_COOKIE } from '../auth/auth.types';
import { PublicStoreInfoDto, StoreSettingsDto, UpdateStoreSettingsDto } from './store-settings.dto';
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
