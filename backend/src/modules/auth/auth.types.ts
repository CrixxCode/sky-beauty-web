import type { Request } from 'express';
import type { AdminRole } from '../../generated/prisma/client';

/** Nombre de la cookie de sesión del panel. Es httpOnly: JavaScript del navegador no puede leerla. */
export const SESSION_COOKIE = 'sb_admin_session';

/** Usuario del panel autenticado en la petición actual. */
export interface AuthenticatedAdmin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  sessionId: string;
}

export interface AdminRequest extends Request {
  admin?: AuthenticatedAdmin;
}

/** Contenido del token firmado que va en la cookie: solo el id de la sesión. */
export interface SessionTokenPayload {
  sid: string;
}
