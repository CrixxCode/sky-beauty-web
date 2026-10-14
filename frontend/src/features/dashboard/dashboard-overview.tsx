'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, BellRing, ClipboardList, CreditCard, FileText } from 'lucide-react';
import Link from 'next/link';
import { AdminPanel, AdminStat } from '@/features/admin-auth/admin-ui';
import { apiFetch } from '@/lib/api';
import { bogotaDate, formatCOP } from '@/lib/format';
import type { DashboardPending } from '@/types/dashboard';
import type { SalesReport } from '@/types/reports';

const LOADING = '…';
const count = (value: number | undefined) => (value === undefined ? LOADING : String(value));

/** Pendientes del día: los ve todo el panel; cada tarjeta lleva a su sección. */
export function DashboardPendingStats() {
  const pending = useQuery({
    queryKey: ['admin-dashboard-pending'],
    queryFn: () => apiFetch<DashboardPending>('/admin/dashboard/pending'),
  });
  const data = pending.data;

  return (
    <div className="grid grid-cols-4 gap-4.75 max-[850px]:grid-cols-2 max-[600px]:gap-2.5">
      <AdminStat
        href="/admin/pedidos"
        icon={<FileText size={19} />}
        label="Pedidos por confirmar"
        value={count(data?.ordersToConfirm)}
        detail="Registrados, sin confirmar"
      />
      <AdminStat
        href="/admin/pagos"
        icon={<CreditCard size={19} />}
        label="Pagos por verificar"
        value={count(data?.paymentsToVerify)}
        detail="Con comprobante recibido"
      />
      <AdminStat
        href="/admin/avisos"
        icon={<BellRing size={19} />}
        label="Avisos por enviar"
        value={count(data?.noticesToSend)}
        detail="Avisos de cancelación al cliente"
      />
      <AdminStat
        href="/admin/inventario"
        icon={<ClipboardList size={19} />}
        label="Stock bajo"
        value={count(data?.lowStockVariants)}
        detail="Variantes en o bajo su umbral"
      />
    </div>
  );
}

/**
 * Ventas de los últimos 30 días (solo la propietaria). Replica el gráfico de actividad del
 * prototipo (.fake-chart) con las ventas reales: pedidos con el pago verificado.
 */
export function DashboardSales() {
  const today = new Date();
  const from = bogotaDate(new Date(today.getTime() - 29 * 86_400_000));
  const to = bogotaDate(today);
  const sales = useQuery({
    queryKey: ['admin-report', 'sales', `dashboard-${from}-${to}`],
    queryFn: () => apiFetch<SalesReport>(`/admin/reports/sales?from=${from}&to=${to}&groupBy=day`),
  });
  const data = sales.data;
  const peak = Math.max(0, ...(data?.series.map((day) => day.total) ?? []));
  const barHeight = (total: number) =>
    peak > 0 && total > 0 ? `${Math.max((total / peak) * 100, 3)}%` : '0%';

  return (
    <AdminPanel>
      <div className="mb-5.75 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#493a45]">Ventas de los últimos 30 días</h2>
        <BarChart3 size={19} className="text-[#936591]" />
      </div>
      {sales.isError ? (
        <p className="text-[11px] text-danger">No se pudieron cargar las ventas.</p>
      ) : (
        <>
          <dl className="mb-2 grid grid-cols-3 gap-3 text-[10px] text-[#8b7e88]">
            <div>
              <dt>Total vendido</dt>
              <dd className="mt-1 text-base font-semibold text-[#493a45] max-[600px]:text-xs">
                {data ? formatCOP(data.summary.total) : LOADING}
              </dd>
            </div>
            <div>
              <dt>Pedidos pagados</dt>
              <dd className="mt-1 text-base font-semibold text-[#493a45] max-[600px]:text-xs">
                {count(data?.summary.orders)}
              </dd>
            </div>
            <div>
              <dt>Ticket promedio</dt>
              <dd className="mt-1 text-base font-semibold text-[#493a45] max-[600px]:text-xs">
                {data ? formatCOP(data.summary.averageTicket) : LOADING}
              </dd>
            </div>
          </dl>
          <div
            role="img"
            aria-label="Ventas por día de los últimos 30 días"
            className="flex h-57.5 items-end gap-1 border-b border-[#e2dbe2] px-1.25 pt-6.25 max-[600px]:h-40 max-[600px]:gap-0.5"
          >
            {(data?.series ?? []).map((day) => (
              <div key={day.period} className="flex h-full flex-1 items-end">
                <span
                  title={`${day.period}: ${formatCOP(day.total)}`}
                  className="block w-full rounded-t-[3px] bg-linear-to-b from-[#bc9bbc] to-[#e9dbe9]"
                  style={{ height: barHeight(day.total) }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#8b7e88]">
            <span>
              {data && data.summary.orders === 0
                ? 'Aún no hay ventas en este período.'
                : 'Pedidos con el pago verificado, por día.'}
            </span>
            <Link href="/admin/reportes" className="font-semibold text-[#764b77]">
              Ver reportes
            </Link>
          </div>
        </>
      )}
    </AdminPanel>
  );
}
