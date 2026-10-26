'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  CreditCard,
  Edit2,
  Eye,
  MessageCircle,
  PackageCheck,
  PackageOpen,
  Search,
  TriangleAlert,
  Truck,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ListPagination } from '@/components/layout/list-pagination';
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
import { NOTIFICATIONS_KEY, PENDING_NOTICES_KEY } from '@/features/notices/notifications-bell';
import { formatCOP, formatDateTime } from '@/lib/format';
import { ADMIN_PAGE_SIZE, fetchAllPages, pageCount } from '@/lib/pagination';
import type { AdminRole } from '@/types/admin';
import type { PaginatedProducts, Product } from '@/types/catalog';
import type { CancellationNotice } from '@/types/notices';
import { NOTICE_STAGE_LABELS } from '@/types/notices';
import type { AdminOrder, AdminOrderItem, PaginatedAdminOrders } from '@/types/orders';
import type { OrderStatus, PaymentStatus } from '@/types/orders-labels';
import {
  ORDER_EVENT_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/types/orders-labels';
import type { Carrier, ShippingQuote, ShippingStatus } from '@/types/shipping';
import type { ShippingMethod } from '@/types/shipping';
import { SHIPPING_METHOD_LABELS, SHIPPING_STATUS_LABELS } from '@/types/shipping';

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
  initialOrderId = null,
}: {
  role: AdminRole;
  initialPaymentStatus?: PaymentStatus | '';
  title?: string;
  initialOrderId?: string | null;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>(initialPaymentStatus);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(initialOrderId);

  // Cada cambio de búsqueda o filtro vuelve a la primera página.
  function updateFilter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  }
  const changeSearch = updateFilter(setSearch);
  const changeStatus = updateFilter(setStatus);
  const changePaymentStatus = updateFilter(setPaymentStatus);

  const ordersQuery = useQuery({
    queryKey: [...ORDERS_KEY, search, status, paymentStatus, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(ADMIN_PAGE_SIZE) });
      if (search.trim()) params.set('q', search.trim());
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      const qs = params.toString();
      return apiFetch<PaginatedAdminOrders>(`/admin/orders?${qs}`);
    },
    placeholderData: (previous) => previous,
  });

  const detailQuery = useQuery({
    queryKey: ['admin-order', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiFetch<AdminOrder>(`/admin/orders/${selectedId}`),
  });

  const orders = ordersQuery.data?.items ?? [];

  async function refreshDetail() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY }),
      queryClient.invalidateQueries({ queryKey: ['admin-order', selectedId] }),
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-notices'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-notices-pending-count'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-pending'] }),
    ]);
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
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Buscar pedido, cliente o teléfono..."
              aria-label="Buscar pedido"
              className="min-w-0"
            />
            {search && (
              <InputGroupButton onClick={() => changeSearch('')} aria-label="Limpiar búsqueda">
                <X size={14} />
              </InputGroupButton>
            )}
          </InputGroup>
          <Select
            aria-label="Filtrar por estado del pedido"
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar por estado del pago"
            value={paymentStatus}
            onChange={(event) => changePaymentStatus(event.target.value as PaymentStatus | '')}
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
                    <span className="text-[10px] text-[#6d646a]">
                      {order.itemCount} producto(s)
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-[11px]">{order.customerName}</span>
                    <span className="text-[10px] text-[#6d646a]">
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
        <ListPagination
          className="mt-5"
          page={page}
          totalPages={pageCount(ordersQuery.data?.total ?? 0, ADMIN_PAGE_SIZE)}
          onPageChange={setPage}
        />
      </AdminPanel>

      <Modal
        isOpen={Boolean(selectedId)}
        onClose={() => {
          setSelectedId(null);
          if (initialOrderId) router.replace('/admin/pedidos', { scroll: false });
        }}
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
  const [cancelReason, setCancelReason] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(order.total.toString());
  const [rejectReason, setRejectReason] = useState('');
  const refundAmount = order.paymentRecords
    .filter((record) => record.status === 'PAID')
    .reduce((total, record) => total + record.amount, 0);
  const [refundNote, setRefundNote] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmCarrierId, setConfirmCarrierId] = useState(order.shipping?.carrierId ?? '');
  const [carrierQuote, setCarrierQuote] = useState<ShippingQuote | null>(null);
  const latestQuote = useRef('');

  const carriersQuery = useQuery({
    queryKey: ['admin-carriers'],
    queryFn: () => apiFetch<Carrier[]>('/admin/carriers'),
    enabled: order.status === 'PENDING_CONFIRMATION',
  });
  const activeCarriers = (carriersQuery.data ?? []).filter((carrier) => carrier.isActive);

  /** Al elegir la transportadora, el costo del envío se llena con su tarifa para el municipio. */
  async function chooseCarrier(carrierId: string) {
    setConfirmCarrierId(carrierId);
    setCarrierQuote(null);
    latestQuote.current = carrierId;
    if (!carrierId) return;
    try {
      const quote = await apiFetch<ShippingQuote>(
        `/admin/orders/${order.id}/shipping-quote?carrierId=${carrierId}`,
      );
      // Si se eligió otra transportadora mientras llegaba la respuesta, se descarta.
      if (latestQuote.current !== carrierId) return;
      setCarrierQuote(quote);
      if (quote.shippingCost !== null) setShippingCost(String(quote.shippingCost));
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo consultar la tarifa de la transportadora.'));
    }
  }

  const action = useMutation({
    mutationFn: async (
      task:
        | 'confirm'
        | 'shipping'
        | 'preparing'
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
          body: JSON.stringify({
            ...(shippingCost.trim() === '' ? {} : { shippingCost: Number(shippingCost) }),
            ...(confirmCarrierId ? { carrierId: confirmCarrierId } : {}),
          }),
        });
      }
      if (task === 'shipping') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/shipping-cost`, {
          method: 'PATCH',
          body: JSON.stringify({ shippingCost: Number(shippingCost) }),
        });
      }
      if (task === 'preparing') {
        return apiFetch<AdminOrder>(`/admin/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PREPARING' }),
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
            amount: Number(paymentAmount),
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
            amount: refundAmount,
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
  // Mientras el pedido está sin confirmar, el costo se escribe junto al botón de confirmar.
  const canQuoteShipping =
    order.status !== 'PENDING_CONFIRMATION' &&
    order.status !== 'CANCELLED' &&
    order.status !== 'DELIVERED';
  const shippingCostValid = shippingCost.trim() !== '' && Number(shippingCost) >= 0;
  const shippingIncreaseBlocked =
    order.paymentStatus === 'PAID' && Number(shippingCost) > (order.shippingCost ?? 0);
  const paymentAmountValid = paymentAmount.trim() !== '' && Number(paymentAmount) >= 0;
  const paymentExcess = Number(paymentAmount) - order.total;
  const canConfirm = order.shippingCost !== null || shippingCostValid;
  const requiresVerification = order.paymentMethodCode !== 'CASH_ON_DELIVERY';

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
                <span className="ml-2 text-[#6d646a]">{formatDate(event.createdAt)}</span>
                {event.note && <p className="mt-1 text-[#6f606a]">{event.note}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="border border-[#eee8ed] p-4.5">
          <h3 className="mb-3 text-xs font-semibold text-[#493a45]">Pagos</h3>
          {order.paymentRecords.length === 0 && (
            <p className="text-[11px] text-[#6d646a]">Todavía no hay registros de pago.</p>
          )}
          <div className="space-y-2.5">
            {order.paymentRecords.map((record) => (
              <div key={record.id} className="border-b border-[#f0ecf0] pb-2.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <AdminStatus tone={paymentTone(record.status)}>
                    {PAYMENT_STATUS_LABELS[record.status]}
                  </AdminStatus>
                  <span className="text-[#6d646a]">{formatDate(record.createdAt)}</span>
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
        <OrderNotices orderId={order.id} />

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
          <div className="mt-3 border-t border-[#f0ecf0] pt-3">
            <FormField
              id="order-tracking-url"
              label="Enlace de seguimiento del cliente"
              description="Reenvíaselo por WhatsApp si lo perdió. Es privado: no lo publiques."
              className="mb-0"
            >
              <div className="flex gap-2">
                <Input
                  id="order-tracking-url"
                  value={order.trackingUrl}
                  readOnly
                  className="text-[10px]"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copiar enlace de seguimiento"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(order.trackingUrl);
                      toast.success('Enlace copiado.');
                    } catch {
                      toast.error('No se pudo copiar. Selecciona el enlace y cópialo a mano.');
                    }
                  }}
                >
                  <Copy size={15} />
                </Button>
              </div>
            </FormField>
          </div>
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
                    disabled={action.isPending || !shippingCostValid || shippingIncreaseBlocked}
                    onClick={() => action.mutate('shipping')}
                  >
                    <Truck size={15} />
                    Guardar
                  </Button>
                </div>
              </FormField>
              {order.paymentStatus === 'PAID' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No se puede aumentar el envío mientras el pedido esté pagado.
                </p>
              )}
            </div>
          )}
        </section>

        <ShippingSection order={order} refresh={refresh} />

        <section className="border border-[#eee8ed] p-4.5">
          <h3 className="mb-3 text-xs font-semibold text-[#493a45]">Acciones</h3>
          {order.status === 'PENDING_CONFIRMATION' && (
            <div className="mb-3">
              <FormField id="order-carrier" label="Transportadora (opcional)">
                <Select
                  id="order-carrier"
                  value={confirmCarrierId}
                  onChange={(event) => void chooseCarrier(event.target.value)}
                >
                  <option value="">Sin elegir todavía</option>
                  {activeCarriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              {carrierQuote && (
                <p className="-mt-2 mb-3.5 text-[10px] text-[#6d646a]">
                  {carrierQuote.source === 'CARRIER_RATE'
                    ? `Tarifa de ${carrierQuote.carrierName} para ${carrierQuote.municipalityName}.`
                    : carrierQuote.source === 'FREE'
                      ? 'El pedido tiene envío gratis: se mantiene.'
                      : `${carrierQuote.carrierName} no tiene tarifa para ${carrierQuote.municipalityName}: se conserva el costo actual.`}
                </p>
              )}
              <FormField
                id="order-shipping-cost"
                label="Costo del envío (COP)"
                description={
                  order.shippingCost === null
                    ? 'Cotiza el envío con el cliente y escríbelo aquí para confirmar.'
                    : 'Ya registrado. Cámbialo solo si cotizaste otro valor.'
                }
              >
                <Input
                  id="order-shipping-cost"
                  value={shippingCost}
                  onChange={(event) => setShippingCost(event.target.value)}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                />
              </FormField>
              <Button
                className="w-full"
                disabled={action.isPending || !canConfirm}
                onClick={() => action.mutate('confirm')}
              >
                <PackageCheck size={16} />
                Confirmar pedido
              </Button>
            </div>
          )}
          {order.status === 'CONFIRMED' && (
            <div className="mb-3">
              <Button
                className="w-full"
                variant="outline"
                disabled={action.isPending}
                onClick={() => action.mutate('preparing')}
              >
                <PackageOpen size={16} />
                Marcar en preparación
              </Button>
              {requiresVerification && (
                <p className="mt-2 text-[10px] text-[#6d646a]">
                  Pasa solo a «Preparando» cuando se verifica el pago.
                </p>
              )}
            </div>
          )}
          {(order.status === 'CONFIRMED' || order.status === 'PREPARING') && (
            <p className="mb-3 text-[10px] text-[#6d646a]">
              El despacho y la entrega se registran en la sección de envío.
            </p>
          )}
          {order.status === 'DELIVERED' && (
            <p className="text-[11px] text-[#6d646a]">El pedido fue entregado.</p>
          )}
          {order.status === 'CANCELLED' && (
            <p className="text-[11px] text-[#6d646a]">
              Pedido cancelado{order.cancelReason ? `: ${order.cancelReason}` : '.'}
            </p>
          )}
          {canCancel && order.paymentStatus === 'PAID' && (
            <p className="mt-4 border-t border-[#f0ecf0] pt-4 text-[11px] text-[#5f5660]">
              Este pedido tiene el pago verificado. Para cancelarlo, registra primero la devolución
              del dinero en «Gestión de pago»; después podrás cancelarlo aquí.
            </p>
          )}
          {canCancel && order.paymentStatus !== 'PAID' && (
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
                <p className="mt-2 text-[10px] text-[#6d646a]">
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
            <p className="text-[11px] text-[#6d646a]">
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
              <FormField id="payment-note" label="Nota del pago (opcional)">
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
                  <FormField id="payment-amount" label="Monto recibido (COP)">
                    <Input
                      id="payment-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                    />
                  </FormField>
                  {paymentAmountValid && Number(paymentAmount) < order.total && (
                    <p className="text-xs text-muted-foreground">
                      Se rechazará como pago incompleto y comenzará el plazo de aclaración de 8
                      horas.
                    </p>
                  )}
                  {paymentExcess > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Excedente por devolver: {formatCOP(paymentExcess)}. Escribe su soporte en
                      Nota.
                    </p>
                  )}
                  <Button
                    className="w-full"
                    disabled={
                      action.isPending ||
                      !paymentAmountValid ||
                      (paymentExcess > 0 && paymentNote.trim().length < 3)
                    }
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
                <Input id="refund-amount" type="number" min={0} value={refundAmount} readOnly />
              </FormField>
              <p className="mb-3 text-xs text-muted-foreground">
                Solo se permiten devoluciones totales del pago verificado. Los excedentes quedan
                registrados en la nota del pago para su devolución.
              </p>
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

/**
 * Despacho y entrega del pedido, una acción por paso. Los datos ya registrados se corrigen aparte,
 * sin cambiar el estado del envío.
 */
function ShippingSection({ order, refresh }: { order: AdminOrder; refresh: () => Promise<void> }) {
  const shipping = order.shipping;
  const savedStatus: ShippingStatus = shipping?.status ?? 'NOT_SHIPPED';
  const [method, setMethod] = useState<ShippingMethod>(shipping?.method ?? 'CARRIER');
  const [carrierId, setCarrierId] = useState(shipping?.carrierId ?? '');
  const [trackingNumber, setTrackingNumber] = useState(shipping?.trackingNumber ?? '');
  // Se propone el envío cobrado al cliente. Si fue gratis no se sabe cuánto costó: queda vacío.
  const [carrierCost, setCarrierCost] = useState(
    shipping?.carrierCost?.toString() ?? (order.shippingCost ? order.shippingCost.toString() : ''),
  );
  const [notes, setNotes] = useState(shipping?.notes ?? '');
  const [dispatchedAt, setDispatchedAt] = useState(toDateTimeInput(shipping?.dispatchedAt ?? null));
  const [deliveredAt, setDeliveredAt] = useState(toDateTimeInput(shipping?.deliveredAt ?? null));
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incident, setIncident] = useState('');
  const [correcting, setCorrecting] = useState(false);

  const carriersQuery = useQuery({
    queryKey: ['admin-carriers'],
    queryFn: () => apiFetch<Carrier[]>('/admin/carriers'),
  });
  const carriers = (carriersQuery.data ?? []).filter(
    (carrier) => carrier.isActive || carrier.id === shipping?.carrierId,
  );
  const activeCarriers = carriers.filter((carrier) => carrier.isActive);
  // Con una sola transportadora activa, queda elegida.
  const selectedCarrierId = carrierId || (activeCarriers.length === 1 ? activeCarriers[0].id : '');

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<AdminOrder>(`/admin/orders/${order.id}/shipping`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      toast.success('Pedido actualizado.');
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo actualizar el envío.')),
  });

  const details = () => ({
    method,
    carrierId: method === 'CARRIER' ? selectedCarrierId || null : null,
    trackingNumber: method === 'CARRIER' ? trackingNumber.trim() || null : null,
    carrierCost: carrierCost.trim() ? Number(carrierCost) : null,
    notes: notes.trim() || null,
  });

  const isCashOnDelivery = order.paymentMethodCode === 'CASH_ON_DELIVERY';
  const paymentReady = isCashOnDelivery || order.paymentStatus === 'PAID';
  const canDispatch =
    (order.status === 'CONFIRMED' || order.status === 'PREPARING') && savedStatus === 'NOT_SHIPPED';
  const carrierCostValid = carrierCost.trim() === '' || Number(carrierCost) >= 0;
  const detailsReady =
    carrierCostValid &&
    (method === 'LOCAL' || (Boolean(selectedCarrierId) && trackingNumber.trim() !== ''));
  const busy = save.isPending || carriersQuery.isPending;

  const detailFields = (
    <>
      <fieldset className="mb-3.5">
        <legend className="mb-1.5 text-[11px] font-medium text-field-label">Tipo de entrega</legend>
        <RadioGroup
          value={method}
          onValueChange={(value) => setMethod(value as ShippingMethod)}
          className="grid-cols-2 gap-2"
          aria-label="Tipo de entrega"
        >
          {(['CARRIER', 'LOCAL'] as const).map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 border border-[#e7dde4] p-2.5 text-[11px] has-data-[state=checked]:border-[#ad81aa] has-data-[state=checked]:bg-[#faf5fa]"
            >
              <RadioGroupItem value={value} />
              {SHIPPING_METHOD_LABELS[value]}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      {method === 'CARRIER' && (
        <div className="grid gap-x-2 min-[501px]:grid-cols-2">
          <FormField id="shipping-carrier" label="Transportadora">
            <Select
              id="shipping-carrier"
              value={selectedCarrierId}
              onChange={(event) => setCarrierId(event.target.value)}
            >
              <option value="">Elige la transportadora</option>
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
        </div>
      )}
      <FormField
        id="shipping-carrier-cost"
        label={
          method === 'CARRIER'
            ? 'Costo real de la transportadora (COP)'
            : 'Costo real de la entrega (COP)'
        }
        description={
          shipping?.carrierCost == null && order.shippingCost
            ? 'Propuesto con el envío cobrado al cliente. Cámbialo si costó otro valor.'
            : undefined
        }
      >
        <Input
          id="shipping-carrier-cost"
          type="number"
          min={0}
          inputMode="numeric"
          value={carrierCost}
          onChange={(event) => setCarrierCost(event.target.value)}
        />
      </FormField>
      {correcting && (
        <div className="grid gap-x-2 min-[501px]:grid-cols-2">
          <FormField id="shipping-dispatched" label="Despacho">
            <Input
              id="shipping-dispatched"
              type="datetime-local"
              value={dispatchedAt}
              onChange={(event) => setDispatchedAt(event.target.value)}
            />
          </FormField>
          {savedStatus === 'DELIVERED' && (
            <FormField id="shipping-delivered" label="Entrega">
              <Input
                id="shipping-delivered"
                type="datetime-local"
                value={deliveredAt}
                onChange={(event) => setDeliveredAt(event.target.value)}
              />
            </FormField>
          )}
        </div>
      )}
      <FormField id="shipping-notes" label="Notas internas (opcional)">
        <Textarea
          id="shipping-notes"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </FormField>
    </>
  );

  return (
    <section className="border border-[#eee8ed] p-4.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-[#493a45]">Envío</h3>
        <AdminStatus tone={shippingTone(savedStatus)}>
          {SHIPPING_STATUS_LABELS[savedStatus]}
        </AdminStatus>
      </div>

      {order.status === 'CANCELLED' && (
        <p className="text-[11px] text-[#6d646a]">El pedido está cancelado.</p>
      )}
      {order.status === 'PENDING_CONFIRMATION' && (
        <p className="text-[11px] text-[#6d646a]">Confirma el pedido para poder despacharlo.</p>
      )}

      {canDispatch && (
        <div>
          {!paymentReady && (
            <p className="mb-3 border border-[#efd9df] bg-[#fdf6f8] p-3 text-[11px] text-[#98566f]">
              Verifica el pago antes de despachar. Solo el contra entrega sale sin el pago
              verificado.
            </p>
          )}
          {detailFields}
          <Button
            className="w-full"
            disabled={busy || !paymentReady || !detailsReady}
            onClick={() => save.mutate({ ...details(), status: 'IN_TRANSIT' })}
          >
            <Truck size={15} />
            Despachar pedido
          </Button>
          <p className="mt-2 text-[10px] text-[#6d646a]">
            Se registra con la hora actual y queda listo el mensaje de despacho para el cliente.
          </p>
        </div>
      )}

      {shipping && savedStatus !== 'NOT_SHIPPED' && (
        <>
          <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-[#6d646a]">Tipo</dt>
            <dd>{SHIPPING_METHOD_LABELS[shipping.method]}</dd>
            {shipping.method === 'CARRIER' && (
              <>
                <dt className="text-[#6d646a]">Transportadora</dt>
                <dd>{shipping.carrierName ?? '-'}</dd>
                <dt className="text-[#6d646a]">Guía</dt>
                <dd>{shipping.trackingNumber ?? '-'}</dd>
              </>
            )}
            <dt className="text-[#6d646a]">Costo real</dt>
            <dd>
              {shipping.carrierCost === null ? 'Sin registrar' : formatCOP(shipping.carrierCost)}
            </dd>
            {shipping.dispatchedAt && (
              <>
                <dt className="text-[#6d646a]">Despacho</dt>
                <dd>{formatDate(shipping.dispatchedAt)}</dd>
              </>
            )}
            {shipping.deliveredAt && (
              <>
                <dt className="text-[#6d646a]">Entrega</dt>
                <dd>{formatDate(shipping.deliveredAt)}</dd>
              </>
            )}
            {shipping.notes && (
              <>
                <dt className="text-[#6d646a]">Notas</dt>
                <dd className="whitespace-pre-line">{shipping.notes}</dd>
              </>
            )}
          </dl>
          {shipping.trackingUrl && (
            <a
              className="mb-3 inline-block text-[11px] font-medium text-[#7a5178] underline-offset-4 hover:underline"
              href={shipping.trackingUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir el rastreo de la transportadora
            </a>
          )}

          {(savedStatus === 'IN_TRANSIT' || savedStatus === 'INCIDENT') && !correcting && (
            <div className="grid gap-2">
              <Button disabled={busy} onClick={() => save.mutate({ status: 'DELIVERED' })}>
                <PackageCheck size={15} />
                Marcar entregado
              </Button>
              {isCashOnDelivery && order.paymentStatus !== 'PAID' && (
                <p className="text-[10px] text-[#6d646a]">
                  Al marcarlo entregado, el pago contra entrega queda registrado.
                </p>
              )}
              {savedStatus === 'INCIDENT' && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => save.mutate({ status: 'IN_TRANSIT' })}
                >
                  <Truck size={15} />
                  Novedad resuelta: sigue en tránsito
                </Button>
              )}
              {savedStatus === 'IN_TRANSIT' && !incidentOpen && (
                <Button variant="outline" disabled={busy} onClick={() => setIncidentOpen(true)}>
                  <TriangleAlert size={15} />
                  Registrar novedad
                </Button>
              )}
              {savedStatus === 'IN_TRANSIT' && incidentOpen && (
                <div className="border-t border-[#f0ecf0] pt-3">
                  <FormField id="shipping-incident" label="¿Qué pasó con la entrega?">
                    <Textarea
                      id="shipping-incident"
                      rows={2}
                      value={incident}
                      onChange={(event) => setIncident(event.target.value)}
                    />
                  </FormField>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      disabled={busy || incident.trim().length < 3}
                      onClick={() =>
                        save.mutate({
                          status: 'INCIDENT',
                          // La novedad se suma a las notas del envío sin borrar las anteriores.
                          notes: [shipping.notes, `Novedad: ${incident.trim()}`]
                            .filter(Boolean)
                            .join('\n'),
                        })
                      }
                    >
                      Guardar novedad
                    </Button>
                    <Button variant="ghost" onClick={() => setIncidentOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 border-t border-[#f0ecf0] pt-3">
            {correcting ? (
              <>
                {detailFields}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || !detailsReady}
                    onClick={() =>
                      save.mutate({
                        ...details(),
                        status: savedStatus,
                        dispatchedAt: toIsoDateTime(dispatchedAt),
                        deliveredAt: toIsoDateTime(deliveredAt),
                      })
                    }
                  >
                    Guardar corrección
                  </Button>
                  <Button variant="ghost" onClick={() => setCorrecting(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setCorrecting(true)}>
                <Edit2 size={14} />
                Corregir datos del envío
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Mensajes del pedido que faltan por enviar al cliente, sin tener que ir a la bandeja de avisos. */
function OrderNotices({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-notices', 'order', orderId],
    queryFn: () =>
      apiFetch<CancellationNotice[]>(`/admin/notices?status=PENDING&orderId=${orderId}`),
  });

  const markSent = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/notices/${id}/sent`, { method: 'PATCH' }),
    onSuccess: async () => {
      toast.success('Mensaje marcado como enviado.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-notices'] }),
        queryClient.invalidateQueries({ queryKey: PENDING_NOTICES_KEY }),
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-pending'] }),
      ]);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo marcar el mensaje.')),
  });

  if (!query.data?.length) return null;

  return (
    <section
      className="border border-[#e7d3e4] bg-[#faf5fa] p-4.5"
      aria-label="Mensajes por enviar al cliente"
    >
      <h3 className="mb-3 text-xs font-semibold text-[#493a45]">Mensajes por enviar al cliente</h3>
      <div className="space-y-3">
        {query.data.map((notice) => (
          <article
            key={notice.id}
            aria-label={`Mensaje: ${notice.caseName}`}
            className="border-b border-[#eadbe7] pb-3 last:border-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{notice.caseName}</Badge>
              {notice.stage && (
                <Badge variant={notice.stage === 'AFTER' ? 'danger' : 'warning'}>
                  {NOTICE_STAGE_LABELS[notice.stage]}
                </Badge>
              )}
            </div>
            <p className="my-2 text-[11px] leading-relaxed text-[#493a45]">{notice.message}</p>
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
          </article>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-[#6d646a]">
        Abrir WhatsApp no lo marca como enviado: márcalo cuando lo hayas enviado.
      </p>
    </section>
  );
}

function OrderItemRow({ item, role }: { item: AdminOrderItem; role: AdminRole }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#f0ecf0] pb-3 text-[11px]">
      <div>
        <strong className="block text-[#493a45]">{item.productName}</strong>
        <span className="text-[#6d646a]">
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
    // Todos los productos activos, no solo los primeros 100 que entrega una página de la API.
    queryFn: () =>
      fetchAllPages((page, limit) =>
        apiFetch<PaginatedProducts>(`/admin/products?status=ACTIVE&page=${page}&limit=${limit}`),
      ),
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
            {(productsQuery.data ?? []).map((product) => (
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
