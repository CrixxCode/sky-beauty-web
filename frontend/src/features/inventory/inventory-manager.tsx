'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, History, ImageIcon, PackagePlus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
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
import { Textarea } from '@/components/ui/textarea';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type {
  InventoryMovementType,
  InventoryVariant,
  PaginatedInventoryMovements,
} from '@/types/inventory';
import { INVENTORY_MOVEMENT_LABELS } from '@/types/inventory';

const VARIANTS_KEY = ['inventory-variants'];
const MOVEMENTS_KEY = ['inventory-movements'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function InventoryManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [type, setType] =
    useState<Extract<InventoryMovementType, 'INITIAL' | 'PURCHASE' | 'ADJUSTMENT'>>('PURCHASE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const variantsQuery = useQuery({
    queryKey: [...VARIANTS_KEY, search, lowStockOnly],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (lowStockOnly) params.set('lowStock', 'true');
      const qs = params.toString();
      return apiFetch<InventoryVariant[]>(`/admin/inventory/variants${qs ? `?${qs}` : ''}`);
    },
  });

  const movementsQuery = useQuery({
    queryKey: [...MOVEMENTS_KEY, selectedVariantId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', '12');
      if (selectedVariantId) params.set('variantId', selectedVariantId);
      return apiFetch<PaginatedInventoryMovements>(
        `/admin/inventory/movements?${params.toString()}`,
      );
    },
  });

  const createMovement = useMutation({
    mutationFn: () =>
      apiFetch('/admin/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({
          variantId: selectedVariantId,
          type,
          quantity: Number(quantity),
          reason,
        }),
      }),
    onSuccess: async () => {
      toast.success('Movimiento registrado.');
      setQuantity('');
      setReason('');
      await queryClient.invalidateQueries({ queryKey: VARIANTS_KEY });
      await queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo registrar el movimiento.')),
  });

  const variants = variantsQuery.data ?? [];
  const selectedVariant = variants.find((variant) => variant.variantId === selectedVariantId);

  return (
    <div className="grid gap-5 min-[1050px]:grid-cols-[1.5fr_1fr]">
      <AdminPanel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AdminPanelTitle className="mb-0">Existencias por variante</AdminPanelTitle>
            <Badge>{variants.length} variantes</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 max-[600px]:w-full">
            <InputGroup className="max-[600px]:w-full">
              <InputGroupAddon>
                <Search size={15} />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar variante..."
                aria-label="Buscar variante"
                className="w-48 flex-none max-[600px]:w-full max-[600px]:flex-1"
              />
              {search && (
                <InputGroupButton onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                  <X size={14} />
                </InputGroupButton>
              )}
            </InputGroup>
            <Button
              variant={lowStockOnly ? 'primary' : 'outline'}
              onClick={() => setLowStockOnly((value) => !value)}
            >
              <AlertCircle size={14} className="mr-1.5" />
              Stock bajo
            </Button>
          </div>
        </div>

        {variantsQuery.isPending && (
          <p className="text-[11px] text-muted">Cargando inventario...</p>
        )}
        {variantsQuery.isError && (
          <p className="text-[11px] text-danger">No se pudo cargar el inventario.</p>
        )}

        {variants.length > 0 && (
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Producto / Variante</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Umbral</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow
                  key={variant.variantId}
                  tabIndex={0}
                  aria-current={variant.variantId === selectedVariantId ? 'true' : undefined}
                  onClick={() => setSelectedVariantId(variant.variantId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedVariantId(variant.variantId);
                    }
                  }}
                  className="cursor-pointer outline-offset-[-2px] aria-[current=true]:bg-[#faf1fa]"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden bg-[#f4eff2] text-[#c4b7c1]">
                        {variant.thumbnailUrl ? (
                          <img
                            src={variant.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon size={16} />
                        )}
                      </div>
                      <span>
                        <strong className="block text-[11px] text-[#493a45]">
                          {variant.productName}
                        </strong>
                        <span className="text-[10px] text-[#6d646a]">{variant.variantName}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[10px]">{variant.sku}</span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        variant.isLowStock
                          ? 'font-semibold text-amber-700'
                          : 'font-semibold text-[#493a45]'
                      }
                    >
                      {variant.stock} un.
                    </span>
                  </TableCell>
                  <TableCell>{variant.lowStockThreshold ?? 'Sin umbral'}</TableCell>
                  <TableCell>
                    <StockStatus variant={variant} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminPanel>

      <div className="space-y-5">
        <AdminPanel>
          <AdminPanelTitle>Registrar movimiento</AdminPanelTitle>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              createMovement.mutate();
            }}
          >
            <FormField id="inventory-variant" label="Variante">
              <Select
                id="inventory-variant"
                value={selectedVariantId}
                onChange={(event) => setSelectedVariantId(event.target.value)}
              >
                <option value="">Selecciona una variante</option>
                {variants.map((variant) => (
                  <option key={variant.variantId} value={variant.variantId}>
                    {variant.productName} - {variant.variantName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="inventory-type" label="Tipo de movimiento">
              <Select
                id="inventory-type"
                value={type}
                onChange={(event) => setType(event.target.value as typeof type)}
              >
                <option value="PURCHASE">Compra a proveedor</option>
                <option value="INITIAL">Existencias iniciales</option>
                <option value="ADJUSTMENT">Ajuste manual</option>
              </Select>
            </FormField>
            <FormField id="inventory-quantity" label="Cantidad">
              <Input
                id="inventory-quantity"
                type="number"
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={type === 'ADJUSTMENT' ? 'Ej: 3 o -2' : 'Ej: 12'}
              />
            </FormField>
            <FormField
              id="inventory-reason"
              label={type === 'ADJUSTMENT' ? 'Justificación *' : 'Nota (opcional)'}
            >
              <Textarea
                id="inventory-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder={
                  type === 'ADJUSTMENT' ? 'Motivo del ajuste' : 'Por ejemplo, proveedor o factura'
                }
              />
            </FormField>
            {selectedVariant && (
              <p className="text-[10px] text-[#6d646a]">
                Stock actual: <strong>{selectedVariant.stock} unidades</strong>
              </p>
            )}
            <Button
              type="submit"
              disabled={
                !selectedVariantId ||
                !quantity ||
                (type === 'ADJUSTMENT' && !reason.trim()) ||
                createMovement.isPending
              }
              className="w-full"
            >
              <PackagePlus size={14} className="mr-1.5" />
              {createMovement.isPending ? 'Registrando...' : 'Registrar movimiento'}
            </Button>
          </form>
        </AdminPanel>

        <AdminPanel>
          <div className="mb-4 flex items-center gap-2">
            <History size={15} className="text-[#936591]" />
            <AdminPanelTitle className="mb-0">Historial reciente</AdminPanelTitle>
          </div>
          <div className="space-y-3">
            {(movementsQuery.data?.items ?? []).map((movement) => (
              <div
                key={movement.id}
                className="border border-[#eee8ed] bg-[#fcfbfa] p-3 text-[11px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <strong>{INVENTORY_MOVEMENT_LABELS[movement.type]}</strong>
                  <span className={movement.quantity >= 0 ? 'text-success' : 'text-danger'}>
                    {movement.quantity > 0 ? '+' : ''}
                    {movement.quantity}
                  </span>
                </div>
                {!selectedVariantId && (
                  <p className="mt-1 text-[10px] text-[#493a45]">
                    {movement.productName} · {movement.variantName}{' '}
                    <span className="font-mono text-[#6d646a]">{movement.sku}</span>
                  </p>
                )}
                <p className="mt-1 text-[10px] text-[#6d646a]">
                  {movement.stockBefore} {'→'} {movement.stockAfter} un.
                </p>
                {movement.reason && (
                  <p className="mt-1 text-[10px] text-[#625760]">{movement.reason}</p>
                )}
                <p className="mt-1 text-[9px] text-[#6d646a]">
                  {formatDateTime(movement.createdAt)}
                  {movement.createdByName && ` · ${movement.createdByName}`}
                </p>
              </div>
            ))}
            {movementsQuery.data?.items.length === 0 && (
              <p className="text-[11px] text-muted">No hay movimientos registrados.</p>
            )}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}

/** Estado de la variante: inactiva, agotada, con stock bajo o disponible (como el prototipo). */
function StockStatus({ variant }: { variant: InventoryVariant }) {
  if (!variant.isActive) return <AdminStatus tone="out">Inactiva</AdminStatus>;
  if (variant.stock === 0) return <AdminStatus tone="out">Agotado</AdminStatus>;
  if (variant.isLowStock) return <AdminStatus tone="warning">Stock bajo</AdminStatus>;
  return <AdminStatus tone="ok">Disponible</AdminStatus>;
}
