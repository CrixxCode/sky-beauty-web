import { KeyRound, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';
import type { AdminRole } from '@/types/admin';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Si se define, solo se muestra a estos roles. */
  roles?: AdminRole[];
}

// Secciones del panel. Cada módulo agrega aquí las suyas (ver Context/plan-desarrollo.md).
// Vive fuera de admin-shell.tsx ('use client') para poder usarse también en componentes de servidor.
export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard },
  { href: '/admin/cuentas', label: 'Cuentas', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/mi-cuenta', label: 'Mi cuenta', icon: KeyRound },
];

export function navItemsFor(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => !item.roles || item.roles.includes(role));
}
