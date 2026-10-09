import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../../config/env';
import { CurrentAdmin, Public } from './auth.decorators';
import { AdminProfileDto, ChangePasswordDto, LoginDto } from './auth.dto';
import { AuthService } from './auth.service';
import { type AdminRequest, type AuthenticatedAdmin, SESSION_COOKIE } from './auth.types';
import { SessionService } from './session.service';

@ApiTags('Panel: acceso')
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Límite estricto por IP, además del bloqueo por cuenta tras intentos fallidos.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: AdminProfileDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminProfileDto> {
    const { token, expiresAt, admin } = await this.auth.login(dto.email, dto.password, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
    return admin;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiNoContentResponse()
  async logout(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revoke(admin.sessionId);
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOkResponse({ type: AdminProfileDto })
  me(@CurrentAdmin() admin: AuthenticatedAdmin): AdminProfileDto {
    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiNoContentResponse({ description: 'Contraseña cambiada; se cierran las demás sesiones.' })
  async changePassword(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(admin, dto.currentPassword, dto.newPassword);
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/',
    };
  }
}
