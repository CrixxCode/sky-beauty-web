'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { formatCOP } from '@/lib/format';
import {
  createProductSchema,
  createVariantSchema,
  type CreateProductValues,
  type CreateVariantValues,
} from '@/schemas/catalog';
import type { AdminRole } from '@/types/admin';
import type {
  Brand,
  Category,
  PaginatedProducts,
  Product,
  ProductListItem,
  ProductStatus,
  ProductVariant,
} from '@/types/catalog';
import { PRODUCT_STATUS_LABELS } from '@/types/catalog';

export const PRODUCTS_KEY = ['admin-products'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

const th = 'bg-[#f8f5f7] p-3.5 text-left text-[10px] font-semibold text-[#766a73]';
const td = 'border-b border-[#f0ecf0] px-3.5 py-3.25 text-[10px] text-[#625760]';

export function ProductsManager({ role }: { role: AdminRole }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const queryClient = useQueryClient();

  const { data: brands } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => apiFetch<Brand[]>('/admin/brands'),
  });

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => apiFetch<Category[]>('/admin/categories'),
  });

  // Aplanar categorías para selección (solo hojas: subcategorías o principales sin hijos)
  const validCategoriesForProducts: { id: string; name: string }[] = [];
  categories?.forEach((cat) => {
    if (cat.children && cat.children.length > 0) {
      cat.children.forEach((sub) => {
        validCategoriesForProducts.push({
          id: sub.id,
          name: `${cat.name} > ${sub.name}`,
        });
      });
    } else {
      validCategoriesForProducts.push({
        id: cat.id,
        name: cat.name,
      });
    }
  });

  const {
    data: productsData,
    isPending,
    isError,
  } = useQuery({
    queryKey: [...PRODUCTS_KEY, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qStr = params.toString();
      return apiFetch<PaginatedProducts>(`/admin/products${qStr ? `?${qStr}` : ''}`);
    },
  });

  const brandMap = new Map(brands?.map((b) => [b.id, b.name]) ?? []);
  const categoryMap = new Map<string, string>();
  categories?.forEach((cat) => {
    categoryMap.set(cat.id, cat.name);
    cat.children?.forEach((sub) => {
      categoryMap.set(sub.id, `${cat.name} > ${sub.name}`);
    });
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setShowCreateForm((v) => !v);
            if (!showCreateForm) setSelectedProductId(null);
          }}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo producto'}
        </Button>
      </div>

      {showCreateForm && (
        <CreateProductForm
          brands={brands ?? []}
          validCategories={validCategoriesForProducts}
          onCreated={(newProduct) => {
            setShowCreateForm(false);
            setSelectedProductId(newProduct.id);
            queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
          }}
        />
      )}

      {selectedProductId && (
        <ProductDetailEditor
          productId={selectedProductId}
          role={role}
          brands={brands ?? []}
          validCategories={validCategoriesForProducts}
          onClose={() => setSelectedProductId(null)}
        />
      )}

      <AdminPanel>
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
          <AdminPanelTitle className="mb-0">Listado de productos</AdminPanelTitle>
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2 border border-[#e8dfe6] p-2 text-[#917987]">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                aria-label="Buscar producto"
                className="border-0 text-[11px] outline-0"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
              className="border border-[#e8dfe6] bg-white p-2 text-[11px] text-[#493a45] outline-0"
            >
              <option value="">Todos los estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
              <option value="ARCHIVED">Archivado</option>
            </select>
          </div>
        </div>

        {isPending && <p className="text-[11px] text-muted">Cargando productos…</p>}
        {isError && <p className="text-[11px] text-danger">No se pudieron cargar los productos.</p>}

        {productsData && productsData.items.length === 0 && (
          <div className="flex flex-col items-center gap-3 bg-[#fbf9fa] px-5 py-12.5 text-center text-[11px] text-[#948692]">
            <Package size={32} /> No se encontraron productos.
          </div>
        )}

        {productsData && productsData.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 border-collapse">
              <thead>
                <tr>
                  <th className={th}>Producto</th>
                  <th className={th}>Marca</th>
                  <th className={th}>Precio base</th>
                  <th className={th}>Variantes</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productsData.items.map((product) => (
                  <tr
                    key={product.id}
                    className={selectedProductId === product.id ? 'bg-[#fbf6fb]' : undefined}
                  >
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#f4eff2] text-[#99759b]">
                          <Tag size={18} />
                        </div>
                        <div>
                          <span className="block font-medium text-[#493a45]">{product.name}</span>
                          <small className="block text-[9px] text-[#a4979e]">
                            {categoryMap.get(product.categoryId) ?? 'Sin categoría'}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className={td}>{brandMap.get(product.brandId) ?? '—'}</td>
                    <td className={td}>{formatCOP(product.basePrice)}</td>
                    <td className={td}>
                      <span className="font-semibold">{product.variantCount}</span>
                    </td>
                    <td className={td}>
                      <ProductStatusBadge status={product.status} />
                    </td>
                    <td className={td}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProductId(product.id)}
                      >
                        Gestionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}

function ProductStatusBadge({ status }: { status: ProductStatus }) {
  if (status === 'ACTIVE') return <AdminStatus tone="ok">Activo</AdminStatus>;
  if (status === 'DRAFT') return <AdminStatus tone="neutral">Borrador</AdminStatus>;
  if (status === 'INACTIVE') return <AdminStatus tone="out">Inactivo</AdminStatus>;
  return <AdminStatus tone="out">Archivado</AdminStatus>;
}

function CreateProductForm({
  brands,
  validCategories,
  onCreated,
}: {
  brands: Brand[];
  validCategories: { id: string; name: string }[];
  onCreated: (p: Product) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { basePrice: '', isFeatured: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await apiFetch<Product>('/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          slug: values.slug || undefined,
          shortDescription: values.shortDescription || undefined,
          description: values.description,
          brandId: values.brandId,
          categoryId: values.categoryId,
          netContent: values.netContent || undefined,
          basePrice: Number(values.basePrice),
          isFeatured: values.isFeatured,
        }),
      });
      reset();
      toast.success('Producto creado como borrador.');
      onCreated(created);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear el producto.'));
    }
  });

  return (
    <AdminPanel>
      <AdminPanelTitle>Nuevo producto (se crea en Borrador)</AdminPanelTitle>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-x-4.5 min-[601px]:grid-cols-2">
          <FormField id="p-name" label="Nombre del producto" error={errors.name?.message}>
            <Input
              placeholder="Ej. Labial Líquido Mate SuperStay"
              {...fieldA11y('p-name', errors.name?.message)}
              {...register('name')}
            />
          </FormField>

          <FormField id="p-brand" label="Marca (obligatoria)" error={errors.brandId?.message}>
            <Select {...fieldA11y('p-brand', errors.brandId?.message)} {...register('brandId')}>
              <option value="">Selecciona una marca...</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="p-cat"
            label="Categoría (obligatoria)"
            description="Debe ser una subcategoría o categoría sin hijos."
            error={errors.categoryId?.message}
          >
            <Select {...fieldA11y('p-cat', errors.categoryId?.message)} {...register('categoryId')}>
              <option value="">Selecciona una categoría...</option>
              {validCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="p-price"
            label="Precio base en COP"
            description="Las variantes pueden heredar este precio o tener uno propio."
            error={errors.basePrice?.message}
          >
            <Input
              type="number"
              min={0}
              step={100}
              {...fieldA11y('p-price', errors.basePrice?.message)}
              {...register('basePrice')}
            />
          </FormField>

          <FormField
            id="p-netContent"
            label="Contenido neto (opcional)"
            description="Común a todas las variantes, p. ej. 30 ml o 4 g."
            error={errors.netContent?.message}
          >
            <Input
              placeholder="Ej. 5 ml, 30 g"
              {...fieldA11y('p-netContent', errors.netContent?.message)}
              {...register('netContent')}
            />
          </FormField>

          <FormField
            id="p-slug"
            label="Slug (opcional)"
            description="Si se deja vacío se genera del nombre."
            error={errors.slug?.message}
          >
            <Input
              placeholder="ej-labial-liquido-mate"
              {...fieldA11y('p-slug', errors.slug?.message)}
              {...register('slug')}
            />
          </FormField>

          <FormField
            id="p-shortDesc"
            label="Descripción corta (opcional)"
            className="min-[601px]:col-span-2"
            error={errors.shortDescription?.message}
          >
            <Input
              placeholder="Breve resumen de 1-2 líneas para tarjetas"
              {...fieldA11y('p-shortDesc', errors.shortDescription?.message)}
              {...register('shortDescription')}
            />
          </FormField>

          <FormField
            id="p-desc"
            label="Descripción completa"
            className="min-[601px]:col-span-2"
            error={errors.description?.message}
          >
            <Textarea
              rows={4}
              placeholder="Detalles del producto, acabado, fórmula..."
              {...fieldA11y('p-desc', errors.description?.message)}
              {...register('description')}
            />
          </FormField>
        </div>

        <Button type="submit" className="mt-2" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Crear producto'}
        </Button>
      </form>
    </AdminPanel>
  );
}

function ProductDetailEditor({
  productId,
  role,
  brands,
  validCategories,
  onClose,
}: {
  productId: string;
  role: AdminRole;
  brands: Brand[];
  validCategories: { id: string; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const {
    data: product,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => apiFetch<Product>(`/admin/products/${productId}`),
  });

  const changeStatus = useMutation({
    mutationFn: (newStatus: ProductStatus) =>
      apiFetch<Product>(`/admin/products/${productId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: async (updated) => {
      toast.success(`Estado cambiado a ${PRODUCT_STATUS_LABELS[updated.status]}.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-product', productId] });
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar el estado.')),
  });

  const deleteProduct = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/admin/products/${productId}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      toast.success('Producto eliminado.');
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar el producto.')),
  });

  if (isPending) return <p className="text-[11px] text-muted">Cargando detalle del producto…</p>;
  if (isError || !product) return <p className="text-[11px] text-danger">No se pudo cargar el producto.</p>;

  return (
    <AdminPanel className="border-2 border-[#b785b8]">
      <div className="mb-4 flex items-center justify-between border-b border-[#eee8ed] pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b7099]">
            Edición de producto
          </span>
          <h2 className="text-lg font-semibold text-[#493a45]">{product.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-[#8b7f87] hover:bg-[#f6eff5]"
          aria-label="Cerrar editor"
        >
          <X size={18} />
        </button>
      </div>

      {/* Estados y acciones rápidas */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-[#faf7f9] p-3 border border-[#f0ecf0]">
        <div className="flex items-center gap-2 text-xs">
          <span>Estado actual:</span>
          <ProductStatusBadge status={product.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {product.status !== 'ACTIVE' && (
            <Button
              size="sm"
              onClick={() => changeStatus.mutate('ACTIVE')}
              disabled={changeStatus.isPending}
            >
              Publicar / Activar
            </Button>
          )}

          {product.status === 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeStatus.mutate('INACTIVE')}
              disabled={changeStatus.isPending}
            >
              Desactivar (Ocultar)
            </Button>
          )}

          {product.status !== 'ARCHIVED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('¿Deseas archivar este producto? Conservará todo su historial de pedidos.')) {
                  changeStatus.mutate('ARCHIVED');
                }
              }}
              disabled={changeStatus.isPending}
            >
              Archivar
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('¿Eliminar producto definitivamente? Si tiene pedidos registrados fallará.')) {
                deleteProduct.mutate();
              }
            }}
            disabled={deleteProduct.isPending}
            className="text-danger hover:border-danger hover:bg-danger-bg"
          >
            <Trash2 size={13} className="mr-1" /> Eliminar
          </Button>
        </div>
      </div>

      {/* Gestión de Variantes */}
      <div className="mt-6 border-t border-[#eee8ed] pt-4">
        <VariantsManager product={product} role={role} />
      </div>
    </AdminPanel>
  );
}

function VariantsManager({ product, role }: { product: Product; role: AdminRole }) {
  const queryClient = useQueryClient();
  const [showAddVariant, setShowAddVariant] = useState(false);

  const toggleVariant = useMutation({
    mutationFn: ({ variantId, isActive }: { variantId: string; isActive: boolean }) =>
      apiFetch<ProductVariant>(`/admin/products/${product.id}/variants/${variantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: async () => {
      toast.success('Variante actualizada.');
      await queryClient.invalidateQueries({ queryKey: ['admin-product', product.id] });
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo actualizar la variante.')),
  });

  const deleteVariant = useMutation({
    mutationFn: (variantId: string) =>
      apiFetch<void>(`/admin/products/${product.id}/variants/${variantId}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      toast.success('Variante eliminada.');
      await queryClient.invalidateQueries({ queryKey: ['admin-product', product.id] });
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar la variante.')),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#493a45]">
            Variantes ({product.variants.length})
          </h3>
          <p className="text-[10px] text-[#8b7f87]">
            Cada variante puede tener su propio tono/color, SKU, precio y stock.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddVariant((v) => !v)}
        >
          <Plus size={14} className="mr-1" /> {showAddVariant ? 'Cancelar' : 'Agregar variante'}
        </Button>
      </div>

      {showAddVariant && (
        <CreateVariantForm
          productId={product.id}
          role={role}
          basePrice={product.basePrice}
          onCreated={() => {
            setShowAddVariant(false);
            queryClient.invalidateQueries({ queryKey: ['admin-product', product.id] });
            queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
          }}
        />
      )}

      {product.variants.length === 0 ? (
        <div className="rounded bg-[#fbf9fa] p-4 text-center text-[11px] text-[#948692]">
          Este producto no tiene variantes aún. Agrega al menos una variante para poder venderlo.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>SKU</th>
                <th className={th}>Tono / Presentación</th>
                <th className={th}>Precio</th>
                {role === 'ADMIN' && <th className={th}>Costo (compra)</th>}
                <th className={th}>Stock</th>
                <th className={th}>Estado</th>
                <th className={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.id}>
                  <td className={td}>
                    <span className="font-mono text-[10px] font-semibold">{v.sku}</span>
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      {v.colorHex && (
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/20"
                          style={{ backgroundColor: v.colorHex }}
                          title={v.colorHex}
                        />
                      )}
                      <span>{v.name}</span>
                    </div>
                  </td>
                  <td className={td}>
                    {v.price !== null ? (
                      formatCOP(v.price)
                    ) : (
                      <span className="text-muted">
                        Hereda base ({formatCOP(product.basePrice)})
                      </span>
                    )}
                  </td>
                  {role === 'ADMIN' && (
                    <td className={td}>
                      {v.costPrice !== null && v.costPrice !== undefined ? (
                        formatCOP(v.costPrice)
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td className={td}>
                    <span className={v.stock === 0 ? 'text-danger font-semibold' : undefined}>
                      {v.stock}
                    </span>
                    {v.lowStockThreshold !== null && (
                      <small className="ml-1 text-[9px] text-muted">
                        (umbral: {v.lowStockThreshold})
                      </small>
                    )}
                  </td>
                  <td className={td}>
                    <AdminStatus tone={v.isActive ? 'ok' : 'out'}>
                      {v.isActive ? 'Activa' : 'Inactiva'}
                    </AdminStatus>
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleVariant.mutate({ variantId: v.id, isActive: !v.isActive })
                        }
                        disabled={toggleVariant.isPending}
                      >
                        {v.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`¿Eliminar variante "${v.name}" (${v.sku})?`)) {
                            deleteVariant.mutate(v.id);
                          }
                        }}
                        disabled={deleteVariant.isPending}
                        className="text-danger hover:border-danger hover:bg-danger-bg"
                        aria-label="Eliminar variante"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateVariantForm({
  productId,
  role,
  basePrice,
  onCreated,
}: {
  productId: string;
  role: AdminRole;
  basePrice: number;
  onCreated: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateVariantValues>({
    resolver: zodResolver(createVariantSchema),
    defaultValues: {
      sku: '',
      name: '',
      colorHex: '',
      price: '',
      costPrice: '',
      maxPerOrder: '',
      lowStockThreshold: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<ProductVariant>(`/admin/products/${productId}/variants`, {
        method: 'POST',
        body: JSON.stringify({
          sku: values.sku,
          name: values.name,
          colorHex: values.colorHex || undefined,
          price: values.price ? Number(values.price) : undefined,
          costPrice: role === 'ADMIN' && values.costPrice ? Number(values.costPrice) : undefined,
          maxPerOrder: values.maxPerOrder ? Number(values.maxPerOrder) : undefined,
          lowStockThreshold: values.lowStockThreshold ? Number(values.lowStockThreshold) : undefined,
        }),
      });
      toast.success('Variante agregada.');
      onCreated();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear la variante.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="border border-[#b785b8]/30 bg-[#fdfafd] p-4">
      <h4 className="mb-3 text-xs font-semibold text-[#493a45]">Nueva variante</h4>
      <div className="grid gap-x-4 gap-y-2 min-[601px]:grid-cols-3">
        <FormField id="v-sku" label="SKU único" error={errors.sku?.message}>
          <Input placeholder="Ej. MAYB-SS-01" {...fieldA11y('v-sku', errors.sku?.message)} {...register('sku')} />
        </FormField>

        <FormField id="v-name" label="Nombre o tono" error={errors.name?.message}>
          <Input placeholder="Ej. 15 Lover, 20 Pioneer, 50 ml" {...fieldA11y('v-name', errors.name?.message)} {...register('name')} />
        </FormField>

        <FormField
          id="v-color"
          label="Color de muestra (hex, opcional)"
          error={errors.colorHex?.message}
        >
          <Input placeholder="#B785B8" {...fieldA11y('v-color', errors.colorHex?.message)} {...register('colorHex')} />
        </FormField>

        <FormField
          id="v-price"
          label="Precio propio (COP, opcional)"
          description={`Si se deja vacío, usa el precio base (${formatCOP(basePrice)}).`}
          error={errors.price?.message}
        >
          <Input type="number" min={0} step={100} {...fieldA11y('v-price', errors.price?.message)} {...register('price')} />
        </FormField>

        {role === 'ADMIN' && (
          <FormField
            id="v-cost"
            label="Costo de compra (solo ADMIN)"
            error={errors.costPrice?.message}
          >
            <Input type="number" min={0} step={100} {...fieldA11y('v-cost', errors.costPrice?.message)} {...register('costPrice')} />
          </FormField>
        )}

        <FormField
          id="v-max"
          label="Límite por pedido (opcional)"
          error={errors.maxPerOrder?.message}
        >
          <Input type="number" min={1} {...fieldA11y('v-max', errors.maxPerOrder?.message)} {...register('maxPerOrder')} />
        </FormField>

        <FormField
          id="v-low"
          label="Umbral de stock bajo"
          description="Si se deja vacío, toma el de la configuración."
          error={errors.lowStockThreshold?.message}
        >
          <Input type="number" min={0} {...fieldA11y('v-low', errors.lowStockThreshold?.message)} {...register('lowStockThreshold')} />
        </FormField>
      </div>

      <Button type="submit" size="sm" className="mt-3" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Guardar variante'}
      </Button>
    </form>
  );
}
