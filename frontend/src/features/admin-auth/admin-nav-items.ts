import {
  Boxes,
  KeyRound,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react';
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
  { href: '/admin/productos', label: 'Productos', icon: ShoppingBag },
  { href: '/admin/categorias', label: 'Categorías', icon: Boxes },
  { href: '/admin/marcas', label: 'Marcas', icon: Tag },
  { href: '/admin/cuentas', label: 'Cuentas', icon: Users, roles: ['ADMIN'] },
  // El personal ve la configuración en modo solo lectura (Context/decisiones.md).
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
  { href: '/admin/mi-cuenta', label: 'Mi cuenta', icon: KeyRound },
];

export function navItemsFor(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => !item.roles || item.roles.includes(role));
}
