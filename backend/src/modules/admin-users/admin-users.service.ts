import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminRole, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { hashPassword } from '../../shared/security/password';
import { SessionService } from '../auth/session.service';
import type { AdminUserDto, CreateStaffDto, UpdateStaffDto } from './admin-users.dto';

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.AdminUserSelect;

/**
 * Cuentas del panel. Solo la propietaria (ADMIN) las gestiona, y solo puede crear y modificar
 * cuentas del personal (STAFF); su propia cuenta se gestiona con el cambio de contraseña propio
 * y, si la olvida, con el comando del servidor (ver Context/decisiones.md).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  list(): Promise<AdminUserDto[]> {
    return this.prisma.adminUser.findMany({
      select: PUBLIC_FIELDS,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async createStaff(dto: CreateStaffDto): Promise<AdminUserDto> {
    try {
      return await this.prisma.adminUser.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash: await hashPassword(dto.password),
          role: AdminRole.STAFF,
        },
        select: PUBLIC_FIELDS,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una cuenta con ese correo.');
      }
      throw error;
    }
  }

  async updateStaff(id: string, dto: UpdateStaffDto): Promise<AdminUserDto> {
    await this.findStaffOrThrow(id);
    const user = await this.prisma.adminUser.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive },
      select: PUBLIC_FIELDS,
    });
    if (dto.isActive === false) await this.sessions.revokeAllForUser(id);
    return user;
  }

  /** Restablece la contraseña del personal: quita el bloqueo y cierra sus sesiones. */
  async resetStaffPassword(id: string, newPassword: string): Promise<void> {
    await this.findStaffOrThrow(id);
    await this.prisma.adminUser.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(newPassword),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.sessions.revokeAllForUser(id);
  }

  private async findStaffOrThrow(id: string): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({ where: { id }, select: { role: true } });
    if (!user || user.role !== AdminRole.STAFF) {
      throw new NotFoundException('No existe una cuenta del personal con ese identificador.');
    }
  }
}
