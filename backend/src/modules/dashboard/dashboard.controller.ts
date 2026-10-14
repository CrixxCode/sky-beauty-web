import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SESSION_COOKIE } from '../auth/auth.types';
import { DashboardPendingDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

/** Resumen del panel. Las cifras de ventas salen de los reportes (solo la propietaria). */
@ApiTags('Panel: resumen')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('pending')
  @ApiOkResponse({ type: DashboardPendingDto })
  pending(): Promise<DashboardPendingDto> {
    return this.dashboard.pending();
  }
}
