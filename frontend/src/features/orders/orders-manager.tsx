'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Edit2, Eye, PackageCheck, Search, Truck, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { QuantityStepper } from '@/features/cart/quantity-stepper';
import { formatCOP, formatDateTime } from '@/lib/format';
import type { AdminRole } from '@/types/admin';
import type { PaginatedProducts, Product } from '@/types/catalog';
import type { AdminOrder, AdminOrderItem, PaginatedAdminOrders } from '@/types/orders';
import type { OrderStatus, PaymentStatus } from '@/types/orders-labels';
import {
  NEXT_ORDER_STATUSES,
  ORDER_EVENT_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/types/orders-labels';
import type { Carrier, ShippingStatus } from '@/types/shipping';
import type { ShippingMethod } from '@/types/shipping';
import {
  NEXT_SHIPPING_STATUSES,
  SHIPPING_METHOD_LABELS,
  SHIPPING_STATUS_LABELS,
} from '@/types/shipping';

const ORDERS_KEY = ['admin-orders'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;

function formatDate(value: string) {
  return formatDateTime(value);
}

function toDateTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Vacío = no se envía: el servidor usa la hora actual al despachar o entregar. */
function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function statusTone(status: OrderStatus): 'ok' | 'out' | 'neutral' | 'warning' {
  if (status === 'CANCELLED') return 'out';
  if (status === 'PENDING_CONFIRMATION') return 'warning';
  if (status === 'DELIVERED') return 'ok';
  return 'neutral';
}

function paymentTone(status: PaymentStatus): 'ok' | 'out' | 'neutral' | 'warning' {
  if (status === 'PAID') return 'ok';
  if (status === 'REJECTED') return 'out';
  if (status === 'AWAITING_VERIFICATION') return 'warning';
  return 'neutral';
}

function shippingTone(status: ShippingStatus): 'ok' | 'out' | 'neutral' | 'warning' {
  if (status === 'DELIVERED') return 'ok';
  if (status === 'INCIDENT') return 'out';
  if (status === 'IN_TRANSIT') return 'warning';
  return 'neutral';
}

export function OrdersManager({
  role,
  initialPaymentStatus = '',
  title = 'Bandeja de pedidos',
}: {
  role: AdminRole;
  initialPaymentStatus?: PaymentStatus | '';
  title?: string;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>(initialPaymentStatus);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: [...ORDERS_KEY, search, status, paymentStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      const qs = params.toString();
      return apiFetch<PaginatedAdminOrders>(`/admin/orders${qs ? `?${qs}` : ''}`);
    },
  });

  const detailQuery = useQuery({
    queryKey: ['admin-order', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiFetch<AdminOrder>(`/admin/orders/${selectedId}`),
  });

  const orders = ordersQuery.data?.items ?? [];

  async function refreshDetail() {
    await queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    await queryClient.invalidateQueries({ queryKey: ['admin-order', selectedId] });
  }

  return (
    <>
      <AdminPanel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AdminPanelTitle className="mb-0">{title}</AdminPanelTitle>
            <Badge>{ordersQuery.data?.total ?? 0} pedidos</Badge>
          </div>
        </div>

        <div className="mb-5 grid gap-2.5 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
          <InputGroup>
            <InputGroupAddon>
              <Search size={15} />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar pedido, cliente o teléfono..."
              aria-label="Buscar pedido"
              className="min-w-0"
            />
            {search && (
              <InputGroupButton onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                <X size={14} />
              </InputGroupButton>
            )}
          </InputGroup>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus | '')}
          >
            <option value="">Todos los pagos</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {ordersQuery.isPending && <p className="text-[11px] text-muted">Cargando pedidos...</p>}
        {ordersQuery.isError && (
          <p className="text-[11px] text-danger">No se pudieron cargar los pedidos.</p>
        )}

        {orders.length > 0 && (
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <strong className="block text-[11px] text-[#493a45]">{order.code}</strong>
                    <span className="text-[10px] text-[#8b7f87]">
                      {order.itemCount} producto(s)
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-[11px]">{order.customerName}</span>
                    <span className="text-[10px] text-[#8b7f87]">
                      {order.city}, {order.department}
                    </span>
                  </TableCell>
                  <TableCell>
                    <AdminStatus tone={statusTone(order.status)}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </AdminStatus>
                  </TableCell>
                  <TableCell>
                    <AdminStatus tone={paymentTone(order.paymentStatus)}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </AdminStatus>
                  </TableCell>
                  <TableCell>{formatCOP(order.total)}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setSelectedId(order.id)}>
                      <Eye size={14} />
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminPanel>

      <Modal
        isOpen={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={detailQuery.data ? `Pedido ${detailQuery.data.code}` : 'Pedido'}
        description={
          detailQuery.data
            ? `${detailQuery.data.customerName} - ${detailQuery.data.city}`
            : undefined
        }
        maxWidth="4xl"
      >
        {detailQuery.isPending && <p className="text-[11px] text-muted">Cargando detalle...</p>}
        {detailQuery.data && (
          <OrderDetail
            key={`${detailQuery.data.id}-${detailQuery.data.updatedAt}`}
            order={detailQuery.data}
            role={role}
            refresh={refreshDetail}
          />
        )}
      </Modal>
    </>
  );
}

function OrderDetail({
  order,
  role,
  refresh,
}: {
  order: AdminOrder;
  role: AdminRole;
  refresh: () => Promise<void>;
}) {
  const [shippingCost, setShippingCost] = useState(order.shippingCost?.toString() ?? '');
  const nextStatuses = NEXT_ORDER_STATUSES[order.status];
  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>(nextStatuses[0] ?? '');
  const [statusNote, setStatusNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [refundAmount, setRefundAmount] = useState(order.total.toString());
  const [refundNote, setRefundNote] = useState('');
  const [carrierId, setCarrierId] = useState(order.shipping?.carrierId ?? '');
  const [trackingNumber, setTrackingNumber] = useState(order.shipping?.trackingNumber ?? '');
  const [carrierCost, setCarrierCost] = useState(order.shipping?.carrierCost?.toString() ?? '');
  const savedShippingStatus: ShippingStatus = order.shipping?.status ?? 'NOT_SHIPPED';
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(
    order.shipping?.method ?? 'CARRIER',
  );
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>(savedShippingStatus);
  const [dispatchedAt, setDispatchedAt] = useState(
    toDateTimeInput(order.shipping?.dispatchedAt ?? null),
  );
  const [deliveredAt, setDeliveredAt] = useState(
    toDateTimeInput(order.shipping?.deliveredAt ?? null),
  );
  const [shippingNotes, setShippingNotes] = useState(order.shipping?.notes ?? '');
  const [editOpen, setEditOpen] = useState(false);

  const carriersQuery = useQuery({
    queryKey: ['admin-carriers'],
    queryFn: () => apiFetch<Carrier[]>('/admin/carriers'),
  });

  const action = useMutation({
    mutationFn: async (
      task:
        | 'confirm'
        | 'shipping'
        | 'shippingRecord'
        | 'status'
        | 'cancel'
        | 'paymentReceived'
        | 'verifyPayment'
        | 'rejectPayment'
        | 'refundPayment',
    ) => {
      if (task === 'confirm') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/confirm`, {
          method: 'PATCH',
          // Un campo vacío no es envío gratis: se confirma con el costo ya registrado.
          body: JSON.stringify(
            shippingCost.trim() === '' ? {} : { shippingCost: Number(shippingCost) },
          ),
        });
      }
      if (task === 'shipping') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/shipping-cost`, {
          method: 'PATCH',
          body: JSON.stringify({ shippingCost: Number(shippingCost) }),
        });
      }
      if (task === 'shippingRecord') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/shipping`, {
          method: 'PATCH',
          body: JSON.stringify({
            method: shippingMethod,
            carrierId: carrierId || null,
            trackingNumber: trackingNumber || null,
            carrierCost: carrierCost ? Number(carrierCost) : null,
            status: shippingStatus,
            dispatchedAt: toIsoDateTime(dispatchedAt),
            deliveredAt: toIsoDateTime(deliveredAt),
            notes: shippingNotes || null,
          }),
        });
      }
      if (task === 'status') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus, note: statusNote || undefined }),
        });
      }
      if (task === 'paymentReceived') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/payment-received`, {
          method: 'PATCH',
          body: JSON.stringify({
            reference: paymentReference || undefined,
            note: paymentNote || undefined,
          }),
        });
      }
      if (task === 'verifyPayment') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/payment/verify`, {
          method: 'PATCH',
          body: JSON.stringify({
            reference: paymentReference || undefined,
            note: paymentNote || undefined,
          }),
        });
      }
      if (task === 'rejectPayment') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/payment/reject`, {
          method: 'PATCH',
          body: JSON.stringify({ reason: rejectReason }),
        });
      }
      if (task === 'refundPayment') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/payment/refund`, {
          method: 'PATCH',
          body: JSON.stringify({
            amount: Number(refundAmount),
            reference: paymentReference || undefined,
            note: refundNote,
          }),
        });
      }
      return apiFetch<AdminOrder>(`/admin/orders/${order.id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: cancelReason }),
      });
    },
    onSuccess: async () => {
      toast.success('Pedido actualizado.');
      setStatusNote('');
      setCancelReason('');
      setPaymentReference('');
      setPaymentNote('');
      setRejectReason('');
      setRefundNote('');
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo actualizar el pedido.')),
  });

  const canEditItems = order.status === 'PENDING_CONFIRMATION';
  const cancellable =
    order.status !== 'CANCELLED' && order.status !== 'SHIPPED' && order.status !== 'DELIVERED';
  // El personal solo cancela por pago no demostrado, cuando venció el plazo de aclaración (lo
  // calcula el servidor). La propietaria cancela en cualquier otro caso.
  const canCancel = cancellable && (role === 'ADMIN' || order.staffCanCancel);
  const canQuoteShipping = order.status !== 'CANCELLED' && order.status !== 'DELIVERED';
  const shippingCostValid = shippingCost.trim() !== '' && Number(shippingCost) >= 0;
  const canConfirm = order.shippingCost !== null || shippingCostValid;
  const requiresVerification = order.paymentMethodCode !== 'CASH_ON_DELIVERY';
  const carriers = (carriersQuery.data ?? []).filter(
    (carrier) => carrier.isActive || carrier.id === order.shipping?.carrierId,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <div className="space-y-5">
        <section className="border border-[#eee8ed] p-4.5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <AdminStatus tone={statusTone(order.status)}>
                {ORDER_STATUS_LABELS[order.status]}
              </AdminStatus>
              <AdminStatus tone={paymentTone(order.paymentStatus)}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus]}
              </AdminStatus>
            </div>
            {canEditItems && (
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Edit2 size={14} />
                Editar productos
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {order.items.map((item) => (
              <OrderItemRow key={item.id} item={item} role={role} />
            ))}
          </div>
        </section>

        <section className="border border-[#eee8ed] p-4.5">
          <h3 className="mb-3 text-xs font-semibold text-[#493a45]">Historial</h3>
          <div className="space-y-2.5">
            {order.events.map((event) => (
              <div key={event.id} className="border-b border-[#f0ecf0] pb-2.5 text-[11px]">
                <strong>
                  {event.type === 'SHIPPING' && event.toStatus
                    ? `Envío: ${SHIPPING_STATUS_LABELS[event.toStatus as ShippingStatus] ?? event.toStatus}`
                    : event.type === 'PAYMENT_STATUS' && event.toStatus
                      ? `Pago: ${PAYMENT_STATUS_LABELS[event.toStatus as PaymentStatus] ?? event.toStatus}`
                      : event.toStatus
                        ? (ORDER_STATUS_LABELS[event.toStatus as OrderStatus] ?? event.toStatus)
                        : (ORDER_EVENT_LABELS[event.type] ?? event.type)}
                </strong>
                <span className="ml-2 text-[#8b7f87]">{formatDate(event.createdAt)}</span>
                {event.note && <p className="mt-1 text-[#6f606a]">{event.note}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="border border-[#eee8ed] p-4.5">
          <h3 className="mb-3 text-xs font-semibold text-[#493a45]">Pagos</h3>
          {order.paymentRecords.length === 0 && (
            <p className="text-[11px] text-[#8b7f87]">Todavía no hay registros de pago.</p>
          )}
          <div className="space-y-2.5">
            {order.paymentRecords.map((record) => (
              <div key={record.id} className="border-b border-[#f0ecf0] pb-2.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <AdminStatus tone={paymentTone(record.status)}>
                    {PAYMENT_STATUS_LABELS[record.status]}
                  </AdminStatus>
                  <span className="text-[#8b7f87]">{formatDate(record.createdAt)}</span>
                </div>
                <p className="mt-1">
                  Monto: <strong>{formatCOP(record.amount)}</strong>
                  {record.reference ? <span className="ml-2">Ref. {record.reference}</span> : null}
                </p>
                {record.note && <p className="text-[#6f606a]">{record.note}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-5">
        <section className="border border-[#eee8ed] p-4.5 text-[11px] leading-[1.8]">
          <h3 className="mb-3 text-xs font-semibold text-[#493a45]">Cliente y entrega</h3>
          <p>
            <strong>{order.customerName}</strong>
          </p>
          <p>{order.customerPhone}</p>
          <p>{order.addressLine}</p>
          <p>
            {order.city}, {order.department}
          </p>
          {order.deliveryNotes && <p className="mt-2 text-[#7b6775]">{order.deliveryNotes}</p>}
          <p className="mt-3">
            Pago: <strong>{order.paymentMethodName}</strong>
          </p>
        </section>

        <section className="border border-[#eee8ed] p-4.5">
          <h3 className="mb-3 text-xs font-semibold text-[#493a45]">Totales</h3>
          <Summary label="Subtotal" value={formatCOP(order.subtotal)} />
          <Summary label="Descuentos" value={`-${formatCOP(order.discountTotal)}`} />
          <Summary
            label="Envío"
            value={order.shippingCost === null ? 'Por confirmar' : formatCOP(order.shippingCost)}
          />
          <Summary
            label={order.shippingCost === null ? 'Total sin envío' : 'Total'}
            value={formatCOP(order.total)}
            strong
          />
          {canQuoteShipping && (
            <div className="mt-4">
              <FormField id="order-shipping-cost" label="Costo del envío cotizado (COP)">
                <div className="flex gap-2">
                  <Input
                    id="order-shipping-cost"
                    value={shippingCost}
                    onChange={(event) => setShippingCost(event.target.value)}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                  />
                  <Button
                    disabled={action.isPending || !shippingCostValid}
                    onClick={() => action.mutate('shipping')}
                  >
                    <Truck size={15} />
                    Guardar
                  </Button>
                </div>
              </FormField>
            </div>
          )}
        </section>

        <section className="border border-[#eee8ed] p-4.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-[#493a45]">Envío</h3>
            <AdminStatus tone={shippingTone(savedShippingStatus)}>
              {SHIPPING_STATUS_LABELS[savedShippingStatus]}
            </AdminStatus>
          </div>
          {order.shipping?.trackingUrl && (
            <a
              className="mb-3 inline-block text-[11px] font-medium text-[#7a5178] underline-offset-4 hover:underline"
              href={order.shipping.trackingUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir el rastreo de la transportadora
            </a>
          )}
          {order.status === 'CANCELLED' ? (
            <p className="text-[11px] text-[#8b7f87]">El pedido está cancelado.</p>
          ) : (
            <div className="grid gap-x-2">
              <fieldset className="mb-3.5">
                <legend className="mb-1.5 text-[11px] font-medium text-field-label">
                  Tipo de entrega
                </legend>
                <RadioGroup
                  value={shippingMethod}
                  onValueChange={(value) => setShippingMethod(value as ShippingMethod)}
                  className="grid-cols-2 gap-2"
                  aria-label="Tipo de entrega"
                >
                  {(['CARRIER', 'LOCAL'] as const).map((value) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 border border-[#e7dde4] p-2.5 text-[11px] has-[[data-state=checked]]:border-[#ad81aa] has-[[data-state=checked]]:bg-[#faf5fa]"
                    >
                      <RadioGroupItem value={value} />
                      {SHIPPING_METHOD_LABELS[value]}
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
              {shippingMethod === 'CARRIER' && (
                <>
                  <FormField id="shipping-carrier" label="Transportadora">
                    <Select
                      id="shipping-carrier"
                      value={carrierId}
                      onChange={(event) => setCarrierId(event.target.value)}
                    >
                      <option value="">Sin transportadora</option>
                      {carriers.map((carrier) => (
                        <option key={carrier.id} value={carrier.id}>
                          {carrier.name}
                          {!carrier.isActive ? ' (inactiva)' : ''}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField id="shipping-tracking" label="Número de guía">
                    <Input
                      id="shipping-tracking"
                      value={trackingNumber}
                      onChange={(event) => setTrackingNumber(event.target.value)}
                    />
                  </FormField>
                </>
              )}
              <FormField
                id="shipping-carrier-cost"
                label={
                  shippingMethod === 'CARRIER'
                    ? 'Costo real de la transportadora (COP)'
                    : 'Costo real de la entrega (COP)'
                }
              >
                <Input
                  id="shipping-carrier-cost"
                  type="number"
                  min={0}
                  value={carrierCost}
                  onChange={(event) => setCarrierCost(event.target.value)}
                />
              </FormField>
              <FormField id="shipping-status" label="Estado del envío">
                <Select
                  id="shipping-status"
                  value={shippingStatus}
                  onChange={(event) => setShippingStatus(event.target.value as ShippingStatus)}
                >
                  {NEXT_SHIPPING_STATUSES[savedShippingStatus].map((value) => (
                    <option key={value} value={value}>
                      {SHIPPING_STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="grid gap-x-2 min-[501px]:grid-cols-2">
                <FormField id="shipping-dispatched" label="Despacho (opcional)">
                  <Input
                    id="shipping-dispatched"
                    type="datetime-local"
                    value={dispatchedAt}
                    onChange={(event) => setDispatchedAt(event.target.value)}
                  />
                </FormField>
                <FormField id="shipping-delivered" label="Entrega (opcional)">
                  <Input
                    id="shipping-delivered"
                    type="datetime-local"
                    value={deliveredAt}
                    onChange={(event) => setDeliveredAt(event.target.value)}
                  />
                </FormField>
              </div>
              <FormField id="shipping-notes" label="Notas internas (opcional)">
                <Textarea
                  id="shipping-notes"
                  rows={2}
                  value={shippingNotes}
                  onChange={(event) => setShippingNotes(event.target.value)}
                />
              </FormField>
              <p className="mb-3 text-[10px] text-[#8b7f87]">
                {shippingMethod === 'CARRIER'
                  ? 'Para despachar registra transportadora y guía. '
                  : 'La entrega local no lleva transportadora ni guía. '}
                Si dejas las fechas vacías, se usa la hora en que guardas.
              </p>
              <Button
                variant="outline"
                disabled={action.isPending || carriersQuery.isPending}
                onClick={() => action.mutate('shippingRecord')}
              >
                <Truck size={15} />
                Guardar envío
              </Button>
            </div>
          )}
        </section>

        <section className="border border-[#eee8ed] p-4.5">
          <h3 className="mb-3 text-xs font-semibold text-[#493a45]">Acciones</h3>
          {order.status === 'PENDING_CONFIRMATION' && (
            <div className="mb-3">
              <Button
                className="w-full"
                disabled={action.isPending || !canConfirm}
                onClick={() => action.mutate('confirm')}
              >
                <PackageCheck size={16} />
                Confirmar pedido
              </Button>
              {!canConfirm && (
                <p className="mt-2 text-[10px] text-[#8b7f87]">
                  Registra primero el costo del envío cotizado.
                </p>
              )}
            </div>
          )}
          {(order.status === 'CONFIRMED' || order.status === 'PREPARING') && (
            <p className="mb-3 text-[10px] text-[#8b7f87]">
              El despacho y la entrega se registran en la sección de envío.
            </p>
          )}
          {nextStatuses.length > 0 && (
            <div className="grid gap-2">
              <FormField id="order-next-status" label="Nuevo estado">
                <Select
                  id="order-next-status"
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as OrderStatus)}
                >
                  {nextStatuses.map((value) => (
                    <option key={value} value={value}>
                      {ORDER_STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="order-status-note" label="Nota (opcional)">
                <Textarea
                  id="order-status-note"
                  rows={2}
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                />
              </FormField>
              <Button
                variant="outline"
                disabled={action.isPending || !nextStatus}
                onClick={() => action.mutate('status')}
              >
                Cambiar estado
              </Button>
            </div>
          )}
          {order.status === 'DELIVERED' && (
            <p className="text-[11px] text-[#8b7f87]">El pedido fue entregado.</p>
          )}
          {order.status === 'CANCELLED' && (
            <p className="text-[11px] text-[#8b7f87]">
              Pedido cancelado{order.cancelReason ? `: ${order.cancelReason}` : '.'}
            </p>
          )}
          {canCancel && (
            <div className="mt-4 border-t border-[#f0ecf0] pt-4">
              <FormField id="order-cancel-reason" label="Motivo de la cancelación">
                <Textarea
                  id="order-cancel-reason"
                  rows={2}
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
              </FormField>
              <Button
                className="mt-2 w-full"
                variant="destructive"
                disabled={action.isPending || cancelReason.trim().length < 3}
                onClick={() => action.mutate('cancel')}
              >
                Cancelar pedido y liberar existencias
              </Button>
              {role !== 'ADMIN' && (
                <p className="mt-2 text-[10px] text-[#8b7f87]">
                  El personal solo puede cancelar cuando el pago no se demostró y venció el plazo de
                  aclaración.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="border border-[#eee8ed] p-4.5">
          <h3 className="mb-3 text-xs font-semibold text-[#493a45]">Gestión de pago</h3>
          {order.paymentStatus === 'REJECTED' && order.paymentClarificationDeadline && (
            <p className="mb-3 border border-[#efd9df] bg-[#fdf6f8] p-3 text-[11px] text-[#98566f]">
              Pago no demostrado. El cliente tiene hasta{' '}
              <strong>{formatDate(order.paymentClarificationDeadline)}</strong> para aclararlo.
              {order.staffCanCancel && ' El plazo venció: el pedido se puede cancelar.'}
            </p>
          )}
          {!requiresVerification && (
            <p className="text-[11px] text-[#8b7f87]">
              El contra entrega queda pagado al marcar el pedido como entregado.
            </p>
          )}
          {requiresVerification && order.status !== 'CANCELLED' && (
            <div className="space-y-1">
              <FormField id="payment-reference" label="Referencia del comprobante (opcional)">
                <Input
                  id="payment-reference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                />
              </FormField>
              <FormField id="payment-note" label="Nota (opcional)">
                <Textarea
                  id="payment-note"
                  rows={2}
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                />
              </FormField>
              <Button
                className="w-full"
                variant="outline"
                disabled={
                  action.isPending ||
                  order.paymentStatus === 'PAID' ||
                  order.paymentStatus === 'REFUNDED'
                }
                onClick={() => action.mutate('paymentReceived')}
              >
                <CreditCard size={15} />
                Registrar comprobante recibido
              </Button>
              {role === 'ADMIN' && order.paymentStatus === 'AWAITING_VERIFICATION' && (
                <div className="space-y-1 border-t border-[#f0ecf0] pt-3">
                  <Button
                    className="w-full"
                    disabled={action.isPending}
                    onClick={() => action.mutate('verifyPayment')}
                  >
                    Verificar pago
                  </Button>
                  <FormField id="payment-reject-reason" label="Motivo si no hay evidencia del pago">
                    <Textarea
                      id="payment-reject-reason"
                      rows={2}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                    />
                  </FormField>
                  <Button
                    className="w-full"
                    variant="destructive"
                    disabled={action.isPending || rejectReason.trim().length < 3}
                    onClick={() => action.mutate('rejectPayment')}
                  >
                    Rechazar pago
                  </Button>
                </div>
              )}
            </div>
          )}
          {role === 'ADMIN' && order.paymentStatus === 'PAID' && (
            <div className="mt-3 border-t border-[#f0ecf0] pt-3">
              <FormField id="refund-amount" label="Monto a devolver (COP)">
                <Input
                  id="refund-amount"
                  type="number"
                  min={0}
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                />
              </FormField>
              <FormField id="refund-note" label="Motivo o soporte de la devolución">
                <Textarea
                  id="refund-note"
                  rows={2}
                  value={refundNote}
                  onChange={(event) => setRefundNote(event.target.value)}
                />
              </FormField>
              <Button
                className="w-full"
                variant="outline"
                disabled={
                  action.isPending || Number(refundAmount) <= 0 || refundNote.trim().length < 3
                }
                onClick={() => action.mutate('refundPayment')}
              >
                Registrar devolución
              </Button>
            </div>
          )}
        </section>
      </div>

      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar productos"
        description="Disponible solo mientras el pedido no esté confirmado."
        maxWidth="3xl"
      >
        <EditItemsForm
          order={order}
          onSaved={async () => {
            setEditOpen(false);
            await refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function OrderItemRow({ item, role }: { item: AdminOrderItem; role: AdminRole }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#f0ecf0] pb-3 text-[11px]">
      <div>
        <strong className="block text-[#493a45]">{item.productName}</strong>
        <span className="text-[#8b7f87]">
          {item.variantName} - {item.sku}
        </span>
        {item.promotionName && <span className="ml-2 text-[#7a5178]">{item.promotionName}</span>}
        {role === 'ADMIN' && item.unitCost !== null && (
          <span className="block text-[10px] text-[#9b8d95]">
            Costo: {formatCOP(item.unitCost)}
          </span>
        )}
      </div>
      <div className="text-right">
        <span className="block">x{item.quantity}</span>
        <strong>{formatCOP(item.lineTotal)}</strong>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="my-2 flex justify-between gap-3 text-[11px]">
      <span className="text-[#756a72]">{label}</span>
      <span className={strong ? 'font-semibold text-[#493a45]' : 'text-[#493a45]'}>{value}</span>
    </div>
  );
}

function EditItemsForm({ order, onSaved }: { order: AdminOrder; onSaved: () => Promise<void> }) {
  const [lines, setLines] = useState(
    order.items
      .filter((item) => item.variantId)
      .map((item) => ({
        variantId: item.variantId as string,
        label: `${item.productName} - ${item.variantName}`,
        quantity: item.quantity,
      })),
  );
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [formError, setFormError] = useState('');

  const productsQuery = useQuery({
    queryKey: ['admin-products', 'orders-edit'],
    queryFn: () => apiFetch<PaginatedProducts>('/admin/products?status=ACTIVE&limit=100'),
  });
  const productQuery = useQuery({
    queryKey: ['admin-products', productId, 'orders-edit'],
    enabled: Boolean(productId),
    queryFn: () => apiFetch<Product>(`/admin/products/${productId}`),
  });

  const save = useMutation({
    mutationFn: () => {
      if (lines.length === 0) throw new Error('El pedido debe tener al menos un producto.');
      return apiFetch<AdminOrder>(`/admin/orders/${order.id}/items`, {
        method: 'PATCH',
        body: JSON.stringify({
          items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Productos actualizados.');
      await onSaved();
    },
    onError: (error) =>
      setFormError(errorMessage(error, 'No se pudieron actualizar los productos.')),
  });

  const variants = productQuery.data?.variants ?? [];
  const selectedVariant = variants.find((variant) => variant.id === variantId);

  function addVariant() {
    if (!selectedVariant) return;
    setLines((current) => {
      if (current.some((line) => line.variantId === selectedVariant.id)) return current;
      return [
        ...current,
        {
          variantId: selectedVariant.id,
          label: `${productQuery.data?.name} - ${selectedVariant.name}`,
          quantity: 1,
        },
      ];
    });
    setVariantId('');
  }

  return (
    <div className="space-y-4">
      {formError && <FormError>{formError}</FormError>}
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.variantId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <span className="text-[11px]">{line.label}</span>
            <QuantityStepper
              value={line.quantity}
              max={999}
              label={line.label}
              className="w-27.5"
              onChange={(quantity) =>
                setLines((current) =>
                  current.map((item) =>
                    item.variantId === line.variantId ? { ...item, quantity } : item,
                  ),
                )
              }
            />
            <Button
              variant="outline"
              onClick={() =>
                setLines((current) => current.filter((item) => item.variantId !== line.variantId))
              }
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-2 border-t border-[#f0ecf0] pt-4 md:grid-cols-[1fr_1fr_auto]">
        <FormField id="edit-product" label="Producto" className="mb-0">
          <Select
            id="edit-product"
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setVariantId('');
            }}
          >
            <option value="">Selecciona producto</option>
            {(productsQuery.data?.items ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="edit-variant" label="Variante" className="mb-0">
          <Select
            id="edit-variant"
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            disabled={!productId}
          >
            <option value="">Selecciona variante</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} - {variant.sku}
              </option>
            ))}
          </Select>
        </FormField>
        <Button
          variant="outline"
          onClick={addVariant}
          disabled={!selectedVariant}
          className="self-end"
        >
          Agregar producto
        </Button>
      </div>

      <div className="flex justify-end gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
