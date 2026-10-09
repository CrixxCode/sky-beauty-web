import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedAdmin, SessionTokenPayload } from './auth.types';

/** Solo se actualiza lastSeenAt si pasó al menos este tiempo, para no escribir en cada petición. */
const LAST_SEEN_UPDATE_INTERVAL_MS = 60_000;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get ttlMs(): number {
    return this.config.get('ADMIN_SESSION_TTL_MINUTES', { infer: true }) * 60_000;
  }

  async create(
    adminUserId: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const session = await this.prisma.adminSession.create({
      data: {
        adminUserId,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 512),
        ipAddress: meta.ipAddress?.slice(0, 64),
      },
    });
    const payload: SessionTokenPayload = { sid: session.id };
    const token = await this.jwt.signAsync(payload, { expiresIn: Math.floor(this.ttlMs / 1000) });
    return { token, expiresAt };
  }

  /** Devuelve el usuario de una sesión válida, o null si el token, la sesión o el usuario no son válidos. */
  async validate(token: string): Promise<AuthenticatedAdmin | null> {
    let payload: SessionTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionTokenPayload>(token);
    } catch {
      return null;
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { id: payload.sid },
      include: { adminUser: true },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || !session.adminUser.isActive) {
      return null;
    }

    if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_UPDATE_INTERVAL_MS) {
      await this.prisma.adminSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
    }

    const { adminUser } = session;
    return {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      sessionId: session.id,
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Cierra todas las sesiones abiertas de un usuario, salvo (opcionalmente) la actual. */
  async revokeAllForUser(adminUserId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: {
        adminUserId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }
}
