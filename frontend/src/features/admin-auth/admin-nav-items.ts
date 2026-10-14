import {
  BadgePercent,
  BarChart3,
  BellRing,
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  MessageSquareQuote,
  Newspaper,
  Settings,
  ShoppingBag,
  Tag,
  Truck,
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
  { href: '/admin/reportes', label: 'Reportes', icon: BarChart3, roles: ['ADMIN'] },
  { href: '/admin/pedidos', label: 'Pedidos', icon: FileText },
  { href: '/admin/avisos', label: 'Avisos', icon: BellRing },
  { href: '/admin/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/admin/envios', label: 'Envíos', icon: Truck },
  { href: '/admin/productos', label: 'Productos', icon: ShoppingBag },
  { href: '/admin/inventario', label: 'Inventario', icon: ClipboardList },
  { href: '/admin/promociones', label: 'Promociones', icon: BadgePercent, roles: ['ADMIN'] },
  { href: '/admin/categorias', label: 'Categorías', icon: Boxes },
  { href: '/admin/marcas', label: 'Marcas', icon: Tag },
  { href: '/admin/cuentas', label: 'Cuentas', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/contenido', label: 'Contenido', icon: Newspaper },
  { href: '/admin/testimonios', label: 'Testimonios', icon: MessageSquareQuote },
  // El personal ve la configuración en modo solo lectura (Context/decisiones.md).
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
  { href: '/admin/mi-cuenta', label: 'Mi cuenta', icon: KeyRound },
];

export function navItemsFor(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => !item.roles || item.roles.includes(role));
}
