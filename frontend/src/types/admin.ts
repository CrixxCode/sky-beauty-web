export type AdminRole = 'ADMIN' | 'STAFF';

/** Usuario del panel con la sesión iniciada (GET /admin/auth/me). */
export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

/** Cuenta del panel, tal como la lista la gestión de cuentas (GET /admin/users). */
export interface AdminUser extends AdminProfile {
  isActive: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: 'Propietaria',
  STAFF: 'Personal',
};
