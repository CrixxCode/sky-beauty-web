import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '../../generated/prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators';
import { type AdminRequest, SESSION_COOKIE } from './auth.types';
import { SessionService } from './session.service';

/**
 * Guardia global: toda ruta exige una sesión válida del panel, salvo las marcadas con @Public().
 * Si la ruta tiene @Roles(...), además verifica el rol.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<AdminRequest>();
    const token = (request.cookies as Record<string, string | undefined>)[SESSION_COOKIE];
    const admin = token ? await this.sessions.validate(token) : null;
    if (!admin) throw new UnauthorizedException('Debes iniciar sesión.');
    request.admin = admin;

    const roles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(admin.role)) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción.');
    }
    return true;
  }
}
