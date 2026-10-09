import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AdminRole } from '../../generated/prisma/client';
import type { AdminRequest, AuthenticatedAdmin } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/**
 * Marca una ruta como pública (sin sesión del panel).
 * Por defecto TODAS las rutas exigen sesión: la tienda pública debe declararse explícitamente.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe una ruta a los roles indicados. Sin este decorador, cualquier usuario del panel tiene acceso. */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

/** Inyecta el usuario del panel autenticado. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdmin => {
    const admin = ctx.switchToHttp().getRequest<AdminRequest>().admin;
    if (!admin) throw new Error('CurrentAdmin usado en una ruta sin sesión.');
    return admin;
  },
);
