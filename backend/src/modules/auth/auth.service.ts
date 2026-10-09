import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../../shared/security/password';
import type { AdminProfileDto } from './auth.dto';
import type { AuthenticatedAdmin } from './auth.types';
import { SessionService } from './session.service';

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos.';

@Injectable()
export class AuthService implements OnModuleInit {
  /** Hash de referencia para igualar el tiempo de respuesta cuando el correo no existe. */
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hashPassword('contraseña-de-referencia-no-usada');
  }

  async login(
    email: string,
    password: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ token: string; expiresAt: Date; admin: AdminProfileDto }> {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!user) {
      await verifyPassword(this.dummyHash, password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
      throw new HttpException(
        `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${minutes} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!(await verifyPassword(user.passwordHash, password))) {
      await this.registerFailedAttempt(user.id, now);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!user.isActive) throw new UnauthorizedException(INVALID_CREDENTIALS);

    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    const { token, expiresAt } = await this.sessions.create(user.id, meta);
    return {
      token,
      expiresAt,
      admin: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  /** Cambia la contraseña propia y cierra las demás sesiones del usuario. */
  async changePassword(
    admin: AuthenticatedAdmin,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await this.sessions.revokeAllForUser(user.id, admin.sessionId);
  }

  private async registerFailedAttempt(userId: string, now: Date): Promise<void> {
    const maxAttempts = this.config.get('LOGIN_MAX_FAILED_ATTEMPTS', { infer: true });
    const lockMinutes = this.config.get('LOGIN_LOCK_MINUTES', { infer: true });

    const { failedLoginAttempts } = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (failedLoginAttempts >= maxAttempts) {
      await this.prisma.adminUser.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(now.getTime() + lockMinutes * 60_000),
        },
      });
    }
  }
}
