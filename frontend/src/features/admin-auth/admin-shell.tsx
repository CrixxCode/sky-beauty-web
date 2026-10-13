'use client';

import { ArrowLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, type AdminProfile } from '@/types/admin';
import { NotificationsBell, usePendingNoticesCount } from '@/features/notices/notifications-bell';
import { navItemsFor } from './admin-nav-items';

const isActive = (href: string, pathname: string) =>
  href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

/** Estructura del panel (replica .admin-shell, .admin-sidebar y .admin-topbar del prototipo). */
export function AdminShell({ admin, children }: { admin: AdminProfile; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const items = navItemsFor(admin.role);
  const pendingNotices = usePendingNoticesCount();
  const current = items.find((item) => isActive(item.href, pathname));

  async function logout() {
    setLoggingOut(true);
    try {
      await apiFetch<void>('/admin/auth/logout', { method: 'POST' });
    } catch (error) {
      // Si la sesión ya no era válida, igual se vuelve al inicio de sesión.
      if (!(error instanceof ApiError && error.status === 401)) {
        toast.error('No se pudo cerrar la sesión. Intenta de nuevo.');
        setLoggingOut(false);
        return;
      }
    }
    router.replace('/admin/login');
    router.refresh();
  }

  const sideButton =
    'flex w-full items-center gap-3 p-3 text-left text-[11px] text-[#756d76] hover:bg-admin-active hover:font-semibold hover:text-admin-active-text';

  return (
    // h-dvh + overflow-hidden en el contenedor fija la altura total de la pantalla.
    // Cada columna (aside y main) maneja su propio scroll de forma independiente.
    <div className="grid h-dvh overflow-hidden bg-admin-bg min-[851px]:grid-cols-[238px_1fr]">
      <aside
        className={cn(
          // El aside ocupa toda la altura del contenedor y nunca hace scroll propio:
          // solo el <nav> interno tiene overflow-y-auto.
          'flex h-full flex-col border-r border-[#eae6ea] bg-white',
          'max-[850px]:fixed max-[850px]:inset-y-0 max-[850px]:left-0 max-[850px]:z-[143] max-[850px]:w-63.75 max-[850px]:transition-transform max-[850px]:duration-[250ms]',
          mobileOpen ? 'max-[850px]:translate-x-0' : 'max-[850px]:-translate-x-full',
        )}
      >
        <div className="flex h-24 shrink-0 items-center justify-between border-b border-[#eee9ec] px-6">
          <Image
            src="/brand/vertical_logo.svg"
            alt="Sky Beauty by Cielo Oviedo"
            width={146}
            height={72}
            priority
            className="block h-18 w-auto"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-auto w-auto min-h-0 p-0 text-ink enabled:hover:translate-y-0 enabled:hover:bg-transparent min-[851px]:hidden"
            aria-label="Cerrar navegación"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </Button>
        </div>
        {/* Único elemento con scroll en el aside; se desplaza independientemente del contenido. */}
        <nav
          aria-label="Panel"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-5"
        >
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  sideButton,
                  active && 'bg-admin-active font-semibold text-admin-active-text',
                )}
              >
                <Icon size={18} strokeWidth={1.7} />
                {label}
                {href === '/admin/avisos' && pendingNotices > 0 && (
                  <span
                    className="ml-auto grid min-w-5 place-items-center rounded-full bg-mauve-dark px-1.5 text-[9px] font-semibold leading-5 text-white"
                    aria-label={`${pendingNotices} por enviar`}
                  >
                    {pendingNotices}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-[#eee9ec] px-3 pb-5.75 pt-3.5">
          <Link href="/" className={sideButton}>
            <ArrowLeft size={17} /> Ver tienda
          </Link>
          <Button
            variant="ghost"
            className={cn(
              sideButton,
              'min-h-0 justify-start rounded-none font-normal tracking-normal enabled:hover:translate-y-0',
            )}
            onClick={logout}
            disabled={loggingOut}
          >
            <LogOut size={17} /> Cerrar sesión
          </Button>
          <small className="mx-3 mt-3.5 block text-[9px] text-[#9b9198]">
            {admin.name} · {admin.email}
          </small>
        </div>
      </aside>

      {/* El main tiene su propio overflow-y-auto: scrollea independientemente del aside. */}
      <main className="flex min-w-0 flex-col overflow-y-auto">
        <header className="flex h-24 shrink-0 items-center justify-between gap-3.75 border-b border-[#eae6ea] bg-white px-10.5 max-[850px]:h-19 max-[850px]:px-6.75 max-[600px]:h-15 max-[600px]:px-4.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-auto w-auto min-h-0 p-0 text-ink enabled:hover:translate-y-0 enabled:hover:bg-transparent min-[851px]:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegación"
          >
            <Menu />
          </Button>
          <span className="flex items-center gap-2.25 text-[11px] text-[#726971]">
            Sky Beauty <ChevronRight size={14} /> {current?.label}
          </span>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <span className="rounded-[3px] bg-[#f1e4f0] px-2.5 py-1.75 text-[9px] font-semibold uppercase tracking-[.09em] text-[#8a5886]">
              {ROLE_LABELS[admin.role]}
            </span>
          </div>
        </header>
        <div className="mx-auto w-full max-w-387.5 px-11.25 pb-17.5 pt-11.25 max-[850px]:px-5.5 max-[850px]:py-7.5 max-[600px]:px-3.5 max-[600px]:py-6.75">
          {children}
        </div>
      </main>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[142] bg-black/40 min-[851px]:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
