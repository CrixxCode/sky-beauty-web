'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePercent, CalendarClock, Edit2, History, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ListPagination } from '@/components/layout/list-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
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
import { Checkbox } from '@/components/ui/checkbox';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { formatCOP } from '@/lib/format';
import { ADMIN_PAGE_SIZE, fetchAllPages, pageCount } from '@/lib/pagination';
import type { Category, PaginatedProducts, Product } from '@/types/catalog';
import type {
  DiscountType,
  PaginatedPromotions,
  Promotion,
  PromotionRevision,
  PromotionScope,
} from '@/types/promotions';
import { DISCOUNT_TYPE_LABELS, PROMOTION_SCOPE_LABELS } from '@/types/promotions';

const PROMOTIONS_KEY = ['admin-promotions'];

type FormState = {
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  scope: PromotionScope;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  productId: string;
  selectedIds: string[];
};

const emptyForm: FormState = {
  name: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  scope: 'PRODUCT',
  startsAt: '',
  endsAt: '',
  isActive: true,
  productId: '',
  selectedIds: [],
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;

function toDatetimeLocal(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toPayload(form: FormState) {
  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    scope: form.scope,
    startsAt: new Date(form.startsAt).toISOString(),
    endsAt: new Date(form.endsAt).toISOString(),
    isActive: form.isActive,
    variantIds: form.scope === 'VARIANT' ? form.selectedIds : undefined,
    productIds: form.scope === 'PRODUCT' ? form.selectedIds : undefined,
    categoryIds: form.scope === 'CATEGORY' ? form.selectedIds : undefined,
  };
  return payload;
}

function validateForm(form: FormState): string | null {
  if (!form.name.trim()) return 'Escribe un nombre para la promoción.';
  if (!form.discountValue || Number(form.discountValue) <= 0)
    return 'Indica un descuento mayor a cero.';
  // Un 100 % dejaría el precio final en 0, que no se permite (decisión del 2026-10-15).
  if (form.discountType === 'PERCENTAGE' && Number(form.discountValue) >= 100)
    return 'El descuento porcentual debe ser menor que 100%.';
  if (!form.startsAt || !form.endsAt) return 'Indica fecha de inicio y fecha de fin.';
  if (new Date(form.startsAt) >= new Date(form.endsAt)) {
    return 'La fecha de inicio debe ser anterior a la fecha de fin.';
  }
  if (form.selectedIds.length === 0) return 'Selecciona al menos un destino.';
  return null;
}

function promotionToForm(promotion: Promotion): FormState {
  const selectedIds =
    promotion.scope === 'VARIANT'
      ? promotion.variantIds
      : promotion.scope === 'PRODUCT'
        ? promotion.productIds
        : promotion.categoryIds;
  return {
    name: promotion.name,
    description: promotion.description ?? '',
    discountType: promotion.discountType,
    discountValue: String(promotion.discountValue),
    scope: promotion.scope,
    startsAt: toDatetimeLocal(promotion.startsAt),
    endsAt: toDatetimeLocal(promotion.endsAt),
    isActive: promotion.isActive,
    productId: '',
    selectedIds,
  };
}

export function PromotionsManager() {
  // Hora de referencia para mostrar si cada promoción está vigente, programada o vencida.
  const [now] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [revisionsFor, setRevisionsFor] = useState<Promotion | null>(null);
  const [page, setPage] = useState(1);

  // Cada cambio de búsqueda o filtro vuelve a la primera página.
  function updateFilter(set: (value: string) => void) {
    return (value: string) => {
      set(value);
      setPage(1);
    };
  }
  const changeSearch = updateFilter(setSearch);
  const changeScope = updateFilter(setScopeFilter);
  const changeStatus = updateFilter(setStatusFilter);

  const promotionsQuery = useQuery({
    queryKey: [...PROMOTIONS_KEY, search, scopeFilter, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(ADMIN_PAGE_SIZE) });
      if (search.trim()) params.set('q', search.trim());
      if (scopeFilter) params.set('scope', scopeFilter);
      if (statusFilter) params.set('isActive', statusFilter);
      const qs = params.toString();
      return apiFetch<PaginatedPromotions>(`/admin/promotions?${qs}`);
    },
    placeholderData: (previous) => previous,
  });

  const productsQuery = useQuery({
    queryKey: ['admin-products', 'promotion-targets'],
    // Todos los productos, no solo los primeros 100 que entrega una página de la API.
    queryFn: () =>
      fetchAllPages((page, limit) =>
        apiFetch<PaginatedProducts>(`/admin/products?page=${page}&limit=${limit}`),
      ),
  });

  const categoriesQuery = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => apiFetch<Category[]>('/admin/categories'),
  });

  const selectedProductQuery = useQuery({
    queryKey: ['admin-products', form.productId, 'promotion-variants'],
    queryFn: () => apiFetch<Product>(`/admin/products/${form.productId}`),
    enabled: form.scope === 'VARIANT' && Boolean(form.productId),
  });

  const revisionsQuery = useQuery({
    queryKey: ['admin-promotions', revisionsFor?.id, 'revisions'],
    queryFn: () => apiFetch<PromotionRevision[]>(`/admin/promotions/${revisionsFor?.id}/revisions`),
    enabled: Boolean(revisionsFor),
  });

  const savePromotion = useMutation({
    mutationFn: () => {
      const validation = validateForm(form);
      if (validation) throw new Error(validation);
      const payload = toPayload(form);
      return editing
        ? apiFetch<Promotion>(`/admin/promotions/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : apiFetch<Promotion>('/admin/promotions', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
    },
    onSuccess: async () => {
      toast.success(editing ? 'Promoción actualizada.' : 'Promoción creada.');
      closeForm();
      await queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la promoción.')),
  });

  const products = productsQuery.data ?? [];
  const categories = useMemo(() => {
    const items: { id: string; name: string }[] = [];
    categoriesQuery.data?.forEach((category) => {
      items.push({ id: category.id, name: category.name });
      category.children?.forEach((child) =>
        items.push({ id: child.id, name: `${category.name} > ${child.name}` }),
      );
    });
    return items;
  }, [categoriesQuery.data]);
  const variants = selectedProductQuery.data?.variants ?? [];
  const promotions = promotionsQuery.data?.items ?? [];

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, startsAt: toDatetimeLocal(new Date()) });
  }

  function openEdit(promotion: Promotion) {
    setEditing(promotion);
    setForm(promotionToForm(promotion));
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  function toggleSelected(id: string) {
    setForm((current) => ({
      ...current,
      selectedIds: current.selectedIds.includes(id)
        ? current.selectedIds.filter((item) => item !== id)
        : [...current.selectedIds, id],
    }));
  }

  return (
    <>
      <AdminPanel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AdminPanelTitle className="mb-0">Promociones</AdminPanelTitle>
            <Badge>{promotionsQuery.data?.total ?? 0} registros</Badge>
          </div>
          <Button onClick={openCreate}>
            <BadgePercent size={16} />
            Crear promoción
          </Button>
        </div>

        <div className="mb-5 grid gap-2.5 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
          <InputGroup>
            <InputGroupAddon>
              <Search size={15} />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Buscar promoción..."
              aria-label="Buscar promoción"
              className="min-w-0"
            />
            {search && (
              <InputGroupButton onClick={() => changeSearch('')} aria-label="Limpiar búsqueda">
                <X size={14} />
              </InputGroupButton>
            )}
          </InputGroup>
          <Select value={scopeFilter} onChange={(event) => changeScope(event.target.value)}>
            <option value="">Todos los destinos</option>
            <option value="VARIANT">Variantes</option>
            <option value="PRODUCT">Productos</option>
            <option value="CATEGORY">Categorías</option>
          </Select>
          <Select value={statusFilter} onChange={(event) => changeStatus(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </Select>
        </div>

        {promotionsQuery.isPending && (
          <p className="text-[11px] text-muted">Cargando promociones...</p>
        )}
        {promotionsQuery.isError && (
          <p className="text-[11px] text-danger">No se pudieron cargar las promociones.</p>
        )}

        {promotions.length > 0 && (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Promoción</TableHead>
                <TableHead>Descuento</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((promotion) => (
                <TableRow key={promotion.id}>
                  <TableCell>
                    <strong className="block text-[11px] text-[#493a45]">{promotion.name}</strong>
                    <span className="text-[10px] text-[#8b7f87]">
                      {promotion.revisionCount}{' '}
                      {promotion.revisionCount === 1 ? 'versión' : 'versiones'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {promotion.discountType === 'PERCENTAGE'
                      ? `${promotion.discountValue}%`
                      : formatCOP(promotion.discountValue)}
                  </TableCell>
                  <TableCell>{PROMOTION_SCOPE_LABELS[promotion.scope]}</TableCell>
                  <TableCell>
                    <span className="block text-[10px]">{formatDate(promotion.startsAt)}</span>
                    <span className="block text-[10px] text-[#8b7f87]">
                      {formatDate(promotion.endsAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PromotionStatus promotion={promotion} now={now} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRevisionsFor(promotion)}
                      >
                        <History size={14} />
                        Historial
                      </Button>
                      <Button size="sm" onClick={() => openEdit(promotion)}>
                        <Edit2 size={14} />
                        Editar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ListPagination
          className="mt-5"
          page={page}
          totalPages={pageCount(promotionsQuery.data?.total ?? 0, ADMIN_PAGE_SIZE)}
          onPageChange={setPage}
        />
      </AdminPanel>

      <Modal
        isOpen={Boolean(editing) || form !== emptyForm}
        onClose={closeForm}
        title={editing ? 'Editar promoción' : 'Crear promoción'}
        description="Las promociones no se acumulan: gana la que da mayor descuento y, si empatan, la creada primero."
        maxWidth="4xl"
      >
        <form
          className="grid gap-5 lg:grid-cols-[1fr_1fr]"
          onSubmit={(event) => {
            event.preventDefault();
            savePromotion.mutate();
          }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Condiciones</CardTitle>
              <CardDescription>Nombre, descuento y vigencia de la promoción.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <FormField id="promotion-name" label="Nombre">
                <Input
                  id="promotion-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ej: Lanzamiento temporada"
                />
              </FormField>
              <FormField id="promotion-description" label="Descripción">
                <Textarea
                  id="promotion-description"
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Nota interna opcional"
                />
              </FormField>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField id="promotion-type" label="Tipo">
                  <Select
                    id="promotion-type"
                    value={form.discountType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        discountType: event.target.value as DiscountType,
                      }))
                    }
                  >
                    <option value="PERCENTAGE">Porcentaje</option>
                    <option value="FIXED_AMOUNT">Importe fijo</option>
                  </Select>
                </FormField>
                <FormField id="promotion-value" label="Valor">
                  <Input
                    id="promotion-value"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.discountValue}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, discountValue: event.target.value }))
                    }
                    placeholder={form.discountType === 'PERCENTAGE' ? 'Ej: 15' : 'Ej: 12000'}
                  />
                </FormField>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField id="promotion-start" label="Inicio">
                  <Input
                    id="promotion-start"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startsAt: event.target.value }))
                    }
                  />
                </FormField>
                <FormField id="promotion-end" label="Fin">
                  <Input
                    id="promotion-end"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, endsAt: event.target.value }))
                    }
                  />
                </FormField>
              </div>
              <label className="flex min-h-11.25 items-center gap-2 border border-[#eee5eb] px-3.5 text-[11px] text-[#493a45]">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, isActive: checked === true }))
                  }
                />
                Promoción activa
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Destino</CardTitle>
              <CardDescription>
                Elige si aplica a variantes, productos o categorías.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <FormField id="promotion-scope" label="Aplicar a">
                <Select
                  id="promotion-scope"
                  value={form.scope}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scope: event.target.value as PromotionScope,
                      productId: '',
                      selectedIds: [],
                    }))
                  }
                >
                  <option value="PRODUCT">Productos</option>
                  <option value="VARIANT">Variantes</option>
                  <option value="CATEGORY">Categorías</option>
                </Select>
              </FormField>

              {form.scope === 'VARIANT' && (
                <FormField id="promotion-product" label="Producto">
                  <Select
                    id="promotion-product"
                    value={form.productId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        productId: event.target.value,
                        selectedIds: [],
                      }))
                    }
                  >
                    <option value="">Selecciona un producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}

              <div className="max-h-72 overflow-y-auto border border-[#eee5eb]">
                <TargetList
                  scope={form.scope}
                  products={products}
                  categories={categories}
                  variants={variants}
                  selectedIds={form.selectedIds}
                  toggleSelected={toggleSelected}
                />
              </div>

              <div className="flex items-center gap-2 text-[10px] text-[#7b6775]">
                <CalendarClock size={14} />
                {form.selectedIds.length} destino(s) seleccionado(s)
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savePromotion.isPending}>
                  {savePromotion.isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(revisionsFor)}
        onClose={() => setRevisionsFor(null)}
        title="Historial de versiones"
        description={revisionsFor?.name}
        maxWidth="3xl"
      >
        {revisionsQuery.isPending && (
          <p className="text-[11px] text-muted">Cargando historial...</p>
        )}
        {(revisionsQuery.data ?? []).map((revision) => (
          <div key={revision.id} className="mb-3 border border-[#eee5eb] p-3.5 text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>Versión {revision.revision}</strong>
              <span className="text-[#8b7f87]">{formatDate(revision.validFrom)}</span>
            </div>
            <p className="mt-1.5 text-[#6d5f67]">
              {DISCOUNT_TYPE_LABELS[revision.discountType]} -{' '}
              {revision.discountType === 'PERCENTAGE'
                ? `${revision.discountValue}%`
                : formatCOP(revision.discountValue)}{' '}
              - {PROMOTION_SCOPE_LABELS[revision.scope]}
            </p>
          </div>
        ))}
      </Modal>
    </>
  );
}

function TargetList({
  scope,
  products,
  categories,
  variants,
  selectedIds,
  toggleSelected,
}: {
  scope: PromotionScope;
  products: PaginatedProducts['items'];
  categories: { id: string; name: string }[];
  variants: Product['variants'];
  selectedIds: string[];
  toggleSelected: (id: string) => void;
}) {
  const items =
    scope === 'PRODUCT'
      ? products.map((product) => ({ id: product.id, label: product.name }))
      : scope === 'CATEGORY'
        ? categories.map((category) => ({ id: category.id, label: category.name }))
        : variants.map((variant) => ({
            id: variant.id,
            label: `${variant.name} - ${variant.sku}`,
          }));

  if (items.length === 0) {
    return (
      <p className="px-3.5 py-6 text-center text-[11px] text-[#8b7f87]">
        {scope === 'VARIANT'
          ? 'Selecciona un producto para ver sus variantes.'
          : 'No hay destinos disponibles.'}
      </p>
    );
  }

  return (
    <div className="divide-y divide-[#f0ecf0]">
      {items.map((item) => (
        <label
          key={item.id}
          className="flex min-h-11.25 cursor-pointer items-center gap-2 px-3.5 text-[11px] text-[#493a45] hover:bg-[#fbf7fa]"
        >
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onCheckedChange={() => toggleSelected(item.id)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}

/** Estado según la activación y las fechas: una promoción activa puede estar programada o vencida. */
function PromotionStatus({ promotion, now }: { promotion: Promotion; now: number }) {
  if (!promotion.isActive) return <AdminStatus tone="out">Inactiva</AdminStatus>;
  if (new Date(promotion.startsAt).getTime() > now) {
    return <AdminStatus tone="neutral">Programada</AdminStatus>;
  }
  if (new Date(promotion.endsAt).getTime() < now) {
    return <AdminStatus tone="out">Vencida</AdminStatus>;
  }
  return <AdminStatus tone="ok">Vigente</AdminStatus>;
}
