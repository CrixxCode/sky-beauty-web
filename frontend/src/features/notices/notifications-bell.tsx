'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AdminNotification, AdminNotifications } from '@/types/notices';

export const NOTIFICATIONS_KEY = ['admin-notifications'];
export const PENDING_NOTICES_KEY = ['admin-notices-pending-count'];

/** Cada cuánto se revisan notificaciones nuevas (el ciclo de plazos corre cada minuto). */
const REFRESH_MS = 60_000;

/** Cantidad de avisos por enviar, para el menú del panel. */
export function usePendingNoticesCount(): number {
  const query = useQuery({
    queryKey: PENDING_NOTICES_KEY,
    queryFn: () => apiFetch<{ pending: number }>('/admin/notices/pending-count'),
    refetchInterval: REFRESH_MS,
  });
  return query.data?.pending ?? 0;
}

/** Campana de notificaciones del panel (propietaria y personal). */
export function NotificationsBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => apiFetch<AdminNotifications>('/admin/notifications'),
    refetchInterval: REFRESH_MS,
  });
  const unread = query.data?.unread ?? 0;

  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: refresh,
  });
  const markAllRead = useMutation({
    mutationFn: () => apiFetch<void>('/admin/notifications/read-all', { method: 'PATCH' }),
    onSuccess: refresh,
  });

  function openNotification(notification: AdminNotification) {
    if (!notification.read) markRead.mutate(notification.id);
    setOpen(false);
    router.push(notification.type === 'NOTICE_PENDING' ? '/admin/avisos' : '/admin/pedidos');
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9.5 w-9.5 text-[#5d405b]"
          aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        >
          <Bell size={19} strokeWidth={1.7} />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-4.25 place-items-center rounded-full bg-mauve-dark px-1 text-[9px] font-semibold leading-4.25 text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Notificaciones">
        <div className="flex items-center justify-between gap-2 border-b border-[#f0ecf0] px-4 py-3">
          <h2 className="text-xs font-semibold text-[#493a45]">Notificaciones</h2>
          {unread > 0 && (
            <Button
              variant="link"
              className="min-h-0 gap-1 p-0 text-[10px]"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck size={13} /> Marcar todas como leídas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto overscroll-contain">
          {query.isPending && (
            <p className="px-4 py-6 text-center text-[11px] text-muted">Cargando...</p>
          )}
          {query.data && query.data.items.length === 0 && (
            <p className="px-4 py-6 text-center text-[11px] text-[#6d646a]">
              No hay notificaciones.
            </p>
          )}
          {query.data?.items.map((notification) => (
            <Button
              key={notification.id}
              variant="ghost"
              onClick={() => openNotification(notification)}
              className={cn(
                'block h-auto min-h-0 w-full rounded-none border-b border-[#f6f2f5] px-4 py-3 text-left font-normal tracking-normal',
                !notification.read && 'bg-[#fbf5fb]',
              )}
            >
              <span className="flex items-start gap-2">
                {!notification.read && (
                  <span
                    className="mt-1.25 h-2 w-2 shrink-0 rounded-full bg-[#a46ea4]"
                    aria-label="Sin leer"
                  />
                )}
                <span className="min-w-0">
                  <strong className="block text-[11px] font-semibold text-[#493a45]">
                    {notification.title}
                  </strong>
                  <span className="mt-0.5 block whitespace-normal text-[10px] leading-relaxed text-[#6f606a]">
                    {notification.body}
                  </span>
                  <span className="mt-1 block text-[9px] text-[#6d646a]">
                    {formatDateTime(notification.createdAt)}
                  </span>
                </span>
              </span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
