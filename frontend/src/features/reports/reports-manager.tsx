'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPanel, AdminPanelTitle, AdminStat } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { downloadText, toCsv } from '@/lib/csv';
import { bogotaDate, formatCOP } from '@/lib/format';
import type { MarginsReport, ReportGrouping, SalesReport, TopProduct } from '@/types/reports';

const GROUPING_LABELS: Record<ReportGrouping, string> = {
  day: 'Por día',
  week: 'Por semana',
  month: 'Por mes',
};

function defaultRange() {
  const today = new Date();
  return { from: bogotaDate(new Date(today.getTime() - 29 * 86_400_000)), to: bogotaDate(today) };
}

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : 'No se pudo cargar el reporte.';

/** Reportes de la propietaria (módulo 13). Venta = pedido con pago verificado. */
export function ReportsManager() {
  const [range, setRange] = useState(defaultRange);
  const [groupBy, setGroupBy] = useState<ReportGrouping>('day');
  const qs = `from=${range.from}&to=${range.to}`;
  const validRange = Boolean(range.from && range.to && range.from <= range.to);

  return (
    <div className="grid gap-5">
      <AdminPanel>
        <div className="grid gap-x-3 gap-y-4 min-[601px]:grid-cols-3">
          <FormField id="report-from" label="Desde" className="mb-0">
            <Input
              id="report-from"
              type="date"
              value={range.from}
              max={range.to}
              onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
            />
          </FormField>
          <FormField id="report-to" label="Hasta" className="mb-0">
            <Input
              id="report-to"
              type="date"
              value={range.to}
              min={range.from}
              onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
            />
          </FormField>
          <FormField id="report-group" label="Agrupar ventas" className="mb-0">
            <Select
              id="report-group"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as ReportGrouping)}
            >
              {Object.entries(GROUPING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <p className="mt-3 text-[10px] text-[#6d646a]">
          Cuentan como venta los pedidos con el pago verificado (incluido el contra entrega pagado
          al entregarse), en la fecha en que se verificó el pago. No cuentan los cancelados ni los
          devueltos.
        </p>
        {!validRange && (
          <FormError>Revisa las fechas: la inicial no puede ser posterior a la final.</FormError>
        )}
      </AdminPanel>

      {validRange && (
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="top">Más vendidos</TabsTrigger>
            <TabsTrigger value="margins">Márgenes</TabsTrigger>
          </TabsList>
          <TabsContent value="sales">
            <SalesTab qs={`${qs}&groupBy=${groupBy}`} range={range} groupBy={groupBy} />
          </TabsContent>
          <TabsContent value="top">
            <TopProductsTab qs={qs} range={range} />
          </TabsContent>
          <TabsContent value="margins">
            <MarginsTab qs={qs} range={range} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

type Range = { from: string; to: string };

function useReport<T>(path: string, qs: string) {
  return useQuery({
    queryKey: ['admin-report', path, qs],
    queryFn: () => apiFetch<T>(`/admin/reports/${path}?${qs}`),
  });
}

function SalesTab({ qs, range, groupBy }: { qs: string; range: Range; groupBy: ReportGrouping }) {
  const query = useReport<SalesReport>('sales', qs);
  if (query.isPending) return <Loading />;
  if (query.isError) return <FormError>{errorText(query.error)}</FormError>;
  const { summary, series } = query.data;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-4 gap-4.75 max-[850px]:grid-cols-2 max-[600px]:gap-2.5">
        <AdminStat
          icon={<Wallet size={19} />}
          label="Total vendido"
          value={formatCOP(summary.total)}
          detail="Productos + envío"
        />
        <AdminStat
          icon={<Receipt size={19} />}
          label="Pedidos"
          value={String(summary.orders)}
          detail="Con pago verificado"
        />
        <AdminStat
          icon={<TrendingUp size={19} />}
          label="Ticket promedio"
          value={formatCOP(summary.averageTicket)}
          detail="Total / pedidos"
        />
        <AdminStat
          icon={<ShoppingBag size={19} />}
          label="Productos"
          value={formatCOP(summary.productsRevenue)}
          detail={`Descuentos: ${formatCOP(summary.discounts)} · Envío: ${formatCOP(summary.shippingCharged)}`}
        />
      </div>
      <AdminPanel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <AdminPanelTitle className="mb-0">
            Ventas {GROUPING_LABELS[groupBy].toLowerCase()}
          </AdminPanelTitle>
          <ExportButton
            onClick={() =>
              downloadText(
                `ventas_${range.from}_${range.to}.csv`,
                toCsv(
                  ['Período', 'Pedidos', 'Productos (COP)', 'Total (COP)'],
                  series.map((row) => [row.period, row.orders, row.productsRevenue, row.total]),
                ),
              )
            }
          />
        </div>
        <Table className="min-w-120">
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.map((row) => (
              <TableRow key={row.period}>
                <TableCell>{row.period}</TableCell>
                <TableCell className="text-right">{row.orders}</TableCell>
                <TableCell className="text-right">{formatCOP(row.productsRevenue)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCOP(row.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminPanel>
    </div>
  );
}

function TopProductsTab({ qs, range }: { qs: string; range: Range }) {
  const query = useReport<TopProduct[]>('top-products', `${qs}&limit=50`);
  if (query.isPending) return <Loading />;
  if (query.isError) return <FormError>{errorText(query.error)}</FormError>;

  return (
    <AdminPanel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <AdminPanelTitle className="mb-0">Más vendidos</AdminPanelTitle>
        <ExportButton
          disabled={query.data.length === 0}
          onClick={() =>
            downloadText(
              `mas-vendidos_${range.from}_${range.to}.csv`,
              toCsv(
                ['Producto', 'Variante', 'SKU', 'Unidades', 'Ventas (COP)'],
                query.data.map((row) => [
                  row.productName,
                  row.variantName,
                  row.sku,
                  row.units,
                  row.revenue,
                ]),
              ),
            )
          }
        />
      </div>
      {query.data.length === 0 ? (
        <Empty />
      ) : (
        <Table className="min-w-140">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((row, index) => (
              <TableRow key={row.sku}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <strong className="block text-[11px] text-[#493a45]">{row.productName}</strong>
                  <span className="text-[10px] text-[#6d646a]">{row.variantName}</span>
                </TableCell>
                <TableCell className="font-mono text-[10px]">{row.sku}</TableCell>
                <TableCell className="text-right">{row.units}</TableCell>
                <TableCell className="text-right">{formatCOP(row.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AdminPanel>
  );
}

function MarginsTab({ qs, range }: { qs: string; range: Range }) {
  const query = useReport<MarginsReport>('margins', qs);
  if (query.isPending) return <Loading />;
  if (query.isError) return <FormError>{errorText(query.error)}</FormError>;
  const data = query.data;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-4 gap-4.75 max-[850px]:grid-cols-2 max-[600px]:gap-2.5">
        <AdminStat
          icon={<TrendingUp size={19} />}
          label="Ganancia"
          value={formatCOP(data.profit)}
          detail={`Margen: ${data.marginPct.toLocaleString('es-CO')} %`}
        />
        <AdminStat
          icon={<ShoppingBag size={19} />}
          label="Ventas con costo"
          value={formatCOP(data.revenue)}
          detail="Productos, con descuentos"
        />
        <AdminStat
          icon={<Wallet size={19} />}
          label="Costo de compra"
          value={formatCOP(data.cost)}
          detail="Guardado en cada pedido"
        />
        <AdminStat
          icon={<Receipt size={19} />}
          label="Envío"
          value={formatCOP(data.shippingCharged)}
          detail={`Cobrado · costo real: ${formatCOP(data.shippingCarrierCost)}`}
        />
      </div>
      {data.unitsWithoutCost > 0 && (
        <p className="border border-[#ecd9b5] bg-[#fff9ee] p-3 text-[11px] text-[#7a5413]">
          {data.unitsWithoutCost}{' '}
          {data.unitsWithoutCost === 1 ? 'unidad vendida' : 'unidades vendidas'} (
          {formatCOP(data.revenueWithoutCost)}) no tienen costo de compra registrado y quedan fuera
          del cálculo de la ganancia.
        </p>
      )}
      <AdminPanel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <AdminPanelTitle className="mb-0">Ganancia por producto</AdminPanelTitle>
          <ExportButton
            disabled={data.byProduct.length === 0}
            onClick={() =>
              downloadText(
                `margenes_${range.from}_${range.to}.csv`,
                toCsv(
                  [
                    'Producto',
                    'Variante',
                    'SKU',
                    'Unidades',
                    'Ventas (COP)',
                    'Costo (COP)',
                    'Ganancia (COP)',
                    'Margen (%)',
                  ],
                  data.byProduct.map((row) => [
                    row.productName,
                    row.variantName,
                    row.sku,
                    row.units,
                    row.revenue,
                    row.cost,
                    row.profit,
                    row.marginPct,
                  ]),
                ),
              )
            }
          />
        </div>
        {data.byProduct.length === 0 ? (
          <Empty />
        ) : (
          <Table className="min-w-170">
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Ganancia</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byProduct.map((row) => (
                <TableRow key={row.sku}>
                  <TableCell>
                    <strong className="block text-[11px] text-[#493a45]">{row.productName}</strong>
                    <span className="text-[10px] text-[#6d646a]">
                      {row.variantName} · {row.sku}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{row.units}</TableCell>
                  <TableCell className="text-right">{formatCOP(row.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCOP(row.cost)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCOP(row.profit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.marginPct.toLocaleString('es-CO')} %
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminPanel>
    </div>
  );
}

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={disabled}>
      <Download size={14} /> Exportar CSV
    </Button>
  );
}

const Loading = () => <p className="text-[11px] text-muted">Cargando reporte...</p>;
const Empty = () => (
  <p className="py-6 text-center text-[11px] text-[#6d646a]">No hay ventas en este rango.</p>
);
