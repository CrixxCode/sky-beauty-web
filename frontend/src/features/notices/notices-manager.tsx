'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPanel } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { CancellationNotice, NoticeStatus } from '@/types/notices';
import { NOTICE_STAGE_LABELS } from '@/types/notices';
import { NOTIFICATIONS_KEY, PENDING_NOTICES_KEY } from './notifications-bell';

const NOTICES_KEY = ['admin-notices'];

/** Bandeja de avisos de cancelación para enviar por WhatsApp (propietaria y personal). */
export function NoticesManager() {
  const [tab, setTab] = useState<Extract<NoticeStatus, 'PENDING' | 'SENT'>>('PENDING');
  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
      <TabsList>
        <TabsTrigger value="PENDING">Por enviar</TabsTrigger>
        <TabsTrigger value="SENT">Enviados</TabsTrigger>
      </TabsList>
      <TabsContent value="PENDING">
        <NoticeList status="PENDING" />
      </TabsContent>
      <TabsContent value="SENT">
        <NoticeList status="SENT" />
      </TabsContent>
    </Tabs>
  );
}

function NoticeList({ status }: { status: 'PENDING' | 'SENT' }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...NOTICES_KEY, status],
    queryFn: () => apiFetch<CancellationNotice[]>(`/admin/notices?status=${status}`),
    refetchInterval: 60_000,
  });

  const markSent = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/notices/${id}/sent`, { method: 'PATCH' }),
    onSuccess: async () => {
      toast.success('Aviso marcado como enviado.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: NOTICES_KEY }),
        queryClient.invalidateQueries({ queryKey: PENDING_NOTICES_KEY }),
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'No se pudo marcar el aviso.'),
  });

  if (query.isPending) return <p className="text-[11px] text-muted">Cargando avisos...</p>;
  if (query.isError) {
    return <p className="text-[11px] text-danger">No se pudieron cargar los avisos.</p>;
  }
  if (query.data.length === 0) {
    return (
      <AdminPanel>
        <p className="py-6 text-center text-[11px] text-[#6d646a]">
          {status === 'PENDING' ? 'No hay avisos por enviar.' : 'Todavía no hay avisos enviados.'}
        </p>
      </AdminPanel>
    );
  }

  return (
    <div className="grid gap-3">
      {query.data.map((notice) => (
        <AdminPanel key={notice.id} className="p-4.5">
          <article aria-label={`Aviso del pedido ${notice.orderCode}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-xs text-[#493a45]">Pedido {notice.orderCode}</strong>
                <Badge variant={notice.stage === 'AFTER' ? 'danger' : 'warning'}>
                  {NOTICE_STAGE_LABELS[notice.stage]}
                </Badge>
                <Badge variant="neutral">{notice.caseName}</Badge>
              </div>
              <span className="text-[10px] text-[#6d646a]">
                {notice.stage === 'BEFORE'
                  ? `Se cancela el ${formatDateTime(notice.deadlineAt)}`
                  : `Creado el ${formatDateTime(notice.createdAt)}`}
              </span>
            </div>
            <p className="text-[11px] text-[#625760]">
              {notice.customerName} · {notice.customerPhone}
            </p>
            <p className="my-3 border border-[#eee8ed] bg-[#fcfbfa] p-3 text-[11px] leading-relaxed text-[#493a45]">
              {notice.message}
            </p>
            {status === 'PENDING' ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={notice.whatsappUrl} target="_blank" rel="noreferrer">
                    <MessageCircle size={15} /> Abrir en WhatsApp
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={markSent.isPending}
                  onClick={() => markSent.mutate(notice.id)}
                >
                  <Check size={15} /> Marcar como enviado
                </Button>
              </div>
            ) : (
              <p className="text-[10px] text-[#6d646a]">
                Enviado el {notice.sentAt ? formatDateTime(notice.sentAt) : '-'}
                {notice.sentByName && ` por ${notice.sentByName}`}
              </p>
            )}
          </article>
        </AdminPanel>
      ))}
    </div>
  );
}
