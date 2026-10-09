'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { AdminRole } from '@/types/admin';

interface NavItem {
  href: string;
  label: string;
  /** Si se define, solo se muestra a estos roles. */
  roles?: AdminRole[];
}

// Cada módulo agrega aquí sus secciones (ver Context/plan-desarrollo.md).
const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Inicio' },
  { href: '/admin/cuentas', label: 'Cuentas', roles: ['ADMIN'] },
  { href: '/admin/mi-cuenta', label: 'Mi cuenta' },
];

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav aria-label="Panel" className="flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active =
          item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors',
              active ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
