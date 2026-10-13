import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../auth/auth.decorators';
import { SESSION_COOKIE } from '../auth/auth.types';
import type { AuthenticatedAdmin } from '../auth/auth.types';
import {
  CancellationNoticeDto,
  ListNoticesQueryDto,
  NotificationsDto,
  PendingNoticesCountDto,
} from './notices.dto';
import { NoticesService } from './notices.service';

/** Bandeja de avisos de cancelación (propietaria y personal). */
@ApiTags('Panel: avisos')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/notices')
export class AdminNoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  @ApiOkResponse({ type: CancellationNoticeDto, isArray: true })
  list(@Query() query: ListNoticesQueryDto): Promise<CancellationNoticeDto[]> {
    return this.notices.listNotices(query);
  }

  @Get('pending-count')
  @ApiOkResponse({ type: PendingNoticesCountDto })
  async pendingCount(): Promise<PendingNoticesCountDto> {
    return { pending: await this.notices.pendingCount() };
  }

  @Patch(':id/sent')
  @HttpCode(204)
  @ApiNoContentResponse()
  markSent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<void> {
    return this.notices.markSent(id, admin.id);
  }
}

/** Notificaciones del panel (campana), con lectura por usuario. */
@ApiTags('Panel: notificaciones')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  @ApiOkResponse({ type: NotificationsDto })
  list(@CurrentAdmin() admin: AuthenticatedAdmin): Promise<NotificationsDto> {
    return this.notices.notifications(admin.id);
  }

  @Patch('read-all')
  @HttpCode(204)
  @ApiNoContentResponse()
  markAllRead(@CurrentAdmin() admin: AuthenticatedAdmin): Promise<void> {
    return this.notices.markAllRead(admin.id);
  }

  @Patch(':id/read')
  @HttpCode(204)
  @ApiNoContentResponse()
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<void> {
    return this.notices.markRead(id, admin.id);
  }
}
