'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Edit2,
  Layers,
  Package,
  Plus,
  Search,
  Settings2,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { formatCOP } from '@/lib/format';
import {
  createProductSchema,
  createVariantSchema,
  toNullableNumber,
  updateProductSchema,
  updateVariantSchema,
  type CreateProductValues,
  type CreateVariantValues,
  type UpdateProductValues,
  type UpdateVariantValues,
} from '@/schemas/catalog';
import type { AdminRole } from '@/types/admin';
import type {
  Brand,
  Category,
  PaginatedProducts,
  Product,
  ProductStatus,
  ProductVariant,
} from '@/types/catalog';
import { PRODUCT_STATUS_LABELS } from '@/types/catalog';

export const PRODUCTS_KEY = ['admin-products'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

const th = 'bg-[#f8f5f7] p-3 text-left text-[10px] font-semibold text-[#766a73]';
const td = 'border-b border-[#f0ecf0] px-3 py-3 text-[10px] text-[#625760] align-middle';

export function ProductsManager({ role }: { role: AdminRole }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: brands } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => apiFetch<Brand[]>('/admin/brands'),
  });

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => apiFetch<Category[]>('/admin/categories'),
  });

  // Aplanar categorías para selección (solo hojas válidas para productos)
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
    queryKey: [...PRODUCTS_KEY, search, categoryFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (categoryFilter) params.set('categoryId', categoryFilter);
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
      <AdminPanel>
        {/* Barra superior con título y controles */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AdminPanelTitle className="mb-0">Productos del catálogo</AdminPanelTitle>
            {productsData && (
              <span className="rounded-full bg-[#f4eff3] px-2.5 py-0.5 text-[10px] font-semibold text-[#764b77]">
                {productsData.total} {productsData.total === 1 ? 'producto' : 'productos'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 max-[600px]:w-full">
            {/* Buscador */}
            <div className="relative flex items-center border border-[#e8dfe6] bg-white text-[#917987] transition-colors focus-within:border-[#936591] max-[600px]:w-full">
              <span className="pl-3 text-[#917987]">
                <Search size={15} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                aria-label="Buscar producto"
                className="w-44 px-2.5 py-2 text-[11px] outline-none placeholder:text-[#a0929b] max-[600px]:w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpiar búsqueda"
                  className="pr-2.5 text-[#a0929b] hover:text-[#493a45] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filtro de Categoría */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filtrar por categoría"
              className="border border-[#e8dfe6] bg-white px-3 py-2 text-[11px] text-[#493a45] outline-none focus:border-[#936591] max-[600px]:w-full"
            >
              <option value="">Todas las categorías</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Filtro de Estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
              className="border border-[#e8dfe6] bg-white px-3 py-2 text-[11px] text-[#493a45] outline-none focus:border-[#936591] max-[600px]:w-full"
            >
              <option value="">Todos los estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
              <option value="ARCHIVED">Archivado</option>
            </select>

            <Button onClick={() => setIsCreateOpen(true)} className="max-[600px]:w-full">
              <Plus size={15} className="mr-1.5" /> Crear producto
            </Button>
          </div>
        </div>

        {isPending && <p className="text-[11px] text-muted">Cargando productos…</p>}
        {isError && <p className="text-[11px] text-danger">No se pudieron cargar los productos.</p>}

        {productsData && productsData.items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2.5 bg-[#fbf9fa] border border-[#eee8ed] px-5 py-12 text-center text-[11px] text-[#948692]">
            <Package size={34} className="text-[#c4b7c1]" />
            <p className="font-medium text-[#493a45]">
              {search || categoryFilter || statusFilter
                ? 'No se encontraron productos con estos filtros'
                : 'No hay productos registrados'}
            </p>
            <p className="text-[10px]">
              {search || categoryFilter || statusFilter
                ? 'Intenta restablecer o modificar los criterios de búsqueda.'
                : 'Crea tu primer producto para comenzar a construir el catálogo comercial.'}
            </p>
          </div>
        )}

        {productsData && productsData.items.length > 0 && (
          <div className="overflow-x-auto border border-[#eee8ed]">
            <table className="w-full min-w-160 border-collapse bg-white">
              <thead>
                <tr>
                  <th className={th}>Producto</th>
                  <th className={th}>Marca</th>
                  <th className={th}>Precio base</th>
                  <th className={th}>Variantes y Stock</th>
                  <th className={th}>Estado</th>
                  <th className={`${th} text-right`}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productsData.items.map((product) => (
                  <tr key={product.id} className="hover:bg-[#faf8f9] transition-colors">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[#f4eff3] text-[#936591]">
                          <Tag size={18} />
                        </div>
                        <div>
                          <span className="block font-medium text-[#493a45] leading-tight">
                            {product.name}
                          </span>
                          <span className="mt-0.5 block text-[9px] text-[#a4979e]">
                            {categoryMap.get(product.categoryId) ?? 'Sin categoría'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <span className="font-medium text-[#493a45]">
                        {brandMap.get(product.brandId) ?? '—'}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="font-semibold text-[#493a45]">
                        {formatCOP(product.basePrice)}
                      </span>
                    </td>
                    <td className={td}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-[#493a45]">
                          {product.variantCount} {product.variantCount === 1 ? 'variante' : 'variantes'}
                        </span>
                        {product.variantCount === 0 && (
                          <span className="text-[9px] text-amber-700">Sin variantes</span>
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      <ProductStatusBadge status={product.status} />
                    </td>
                    <td className={`${td} text-right`}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProductId(product.id)}
                      >
                        <Settings2 size={13} className="mr-1.5" />
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

      {/* Modal para Crear Producto */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Nuevo producto"
        description="Ingresa los datos generales para dar de alta el producto. Se creará en estado Borrador."
        maxWidth="2xl"
      >
        <CreateProductForm
          brands={brands ?? []}
          validCategories={validCategoriesForProducts}
          onSuccess={(newProduct) => {
            setIsCreateOpen(false);
            setSelectedProductId(newProduct.id);
            queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
          }}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      {/* Modal para Ver Detalles y Gestionar Producto (SIN MODALES ANIDADOS) */}
      <Modal
        isOpen={!!selectedProductId}
        onClose={() => setSelectedProductId(null)}
        title="Gestión de producto"
        description="Administra las variantes, precios, inventario y visibilidad en catálogo."
        maxWidth="4xl"
      >
        {selectedProductId && (
          <ProductDetailModalContent
            productId={selectedProductId}
            role={role}
            brands={brands ?? []}
            validCategories={validCategoriesForProducts}
            onClose={() => setSelectedProductId(null)}
          />
        )}
      </Modal>
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
  onSuccess,
  onCancel,
}: {
  brands: Brand[];
  validCategories: { id: string; name: string }[];
  onSuccess: (p: Product) => void;
  onCancel: () => void;
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
      onSuccess(created);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear el producto.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-x-4 gap-y-3 min-[601px]:grid-cols-2">
        <FormField id="p-name" label="Nombre del producto *" error={errors.name?.message}>
          <Input
            placeholder="Ej. Labial Líquido Mate SuperStay"
            {...fieldA11y('p-name', errors.name?.message)}
            {...register('name')}
          />
        </FormField>

        <FormField id="p-brand" label="Marca *" error={errors.brandId?.message}>
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
          label="Categoría *"
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
          label="Precio base en COP *"
          description="Las variantes que no definan precio propio usarán este valor."
          error={errors.basePrice?.message}
        >
          <Input
            type="number"
            min={0}
            step={100}
            placeholder="Ej. 35000"
            {...fieldA11y('p-price', errors.basePrice?.message)}
            {...register('basePrice')}
          />
        </FormField>

        <FormField
          id="p-netContent"
          label="Contenido neto (opcional)"
          description="Presentación común a variantes, p. ej. 30 ml o 4 g."
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
          label="Slug URL (opcional)"
          description="Si se deja vacío se generará del nombre."
          error={errors.slug?.message}
        >
          <Input
            placeholder="ej-labial-superstay"
            {...fieldA11y('p-slug', errors.slug?.message)}
            {...register('slug')}
          />
        </FormField>

        <FormField
          id="p-shortDesc"
          label="Descripción corta (opcional)"
          className="min-[601px]:col-span-2"
          description="Resumen breve para tarjetas en el catálogo."
          error={errors.shortDescription?.message}
        >
          <Input
            placeholder="Ej. Labial de larga duración hasta 16 horas con acabado mate intransferible."
            {...fieldA11y('p-shortDesc', errors.shortDescription?.message)}
            {...register('shortDescription')}
          />
        </FormField>

        <FormField
          id="p-desc"
          label="Descripción detallada *"
          className="min-[601px]:col-span-2"
          description="Fórmula, modo de uso y características principales."
          error={errors.description?.message}
        >
          <Textarea
            rows={3}
            placeholder="Detalles del producto, fórmula, beneficios..."
            {...fieldA11y('p-desc', errors.description?.message)}
            {...register('description')}
          />
        </FormField>
      </div>

      <div className="flex justify-end gap-2.5 pt-3 border-t border-[#f0ecf0]">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Crear producto (Borrador)'}
        </Button>
      </div>
    </form>
  );
}

/** Contenido del modal de gestión de producto, organizado por pestañas sin modales anidados */
function ProductDetailModalContent({
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
  const [activeTab, setActiveTab] = useState<'variants' | 'info' | 'status'>('variants');

  const {
    data: product,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => apiFetch<Product>(`/admin/products/${productId}`),
  });

  if (isPending) {
    return <p className="py-8 text-center text-[11px] text-muted">Cargando datos del producto…</p>;
  }

  if (isError || !product) {
    return <p className="py-8 text-center text-[11px] text-danger">No se pudo cargar el producto.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Encabezado contextual del producto dentro del modal */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#eee8ed] bg-[#fcfbfa] p-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#493a45]">{product.name}</h3>
            <ProductStatusBadge status={product.status} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[#8b7f87]">
            <span>Precio base: <strong className="text-[#493a45]">{formatCOP(product.basePrice)}</strong></span>
            <span>·</span>
            <span className="font-mono text-[#a0929b]">/{product.slug}</span>
            <span>·</span>
            <span>{product.variants.length} {product.variants.length === 1 ? 'variante' : 'variantes'}</span>
          </div>
        </div>

        {/* Pestañas de navegación */}
        <div className="flex border border-[#e8dfe6] bg-white p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('variants')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === 'variants'
                ? 'bg-[#764b77] text-white font-semibold'
                : 'text-[#625760] hover:text-[#493a45]'
            }`}
          >
            <Layers size={13} />
            Variantes ({product.variants.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === 'info'
                ? 'bg-[#764b77] text-white font-semibold'
                : 'text-[#625760] hover:text-[#493a45]'
            }`}
          >
            <Edit2 size={13} />
            Información y precios
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === 'status'
                ? 'bg-[#764b77] text-white font-semibold'
                : 'text-[#625760] hover:text-[#493a45]'
            }`}
          >
            <Archive size={13} />
            Estado y publicación
          </button>
        </div>
      </div>

      {/* Contenido según pestaña activa */}
      {activeTab === 'variants' && (
        <VariantsTab product={product} role={role} />
      )}

      {activeTab === 'info' && (
        <ProductInfoTab
          product={product}
          brands={brands}
          validCategories={validCategories}
        />
      )}

      {activeTab === 'status' && (
        <ProductStatusTab
          product={product}
          onDeleted={onClose}
        />
      )}
    </div>
  );
}

/** Pestaña 1: Variantes e inventario con formulario inline (sin modal anidado) */
function VariantsTab({ product, role }: { product: Product; role: AdminRole }) {
  const queryClient = useQueryClient();
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [isAdding, setIsAdding] = useState(false);

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

  const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0);

  return (
    <div className="space-y-3.5">
      {/* Barra de variantes con conteo y botón para agregar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-[#625760]">
            Stock total acumulado:{' '}
            <strong className="text-[#493a45]">{totalStock} unidades</strong>
          </p>
        </div>

        {!isAdding && !editingVariant && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus size={14} className="mr-1" /> Agregar variante
          </Button>
        )}
      </div>

      {/* Formulario INLINE para Crear Variante (Reemplaza al modal anidado) */}
      {isAdding && (
        <div className="border border-[#764b77]/30 bg-[#fbf9fb] p-4.5 rounded shadow-xs">
          <div className="mb-3 flex items-center justify-between border-b border-[#ebddeb] pb-2.5">
            <h4 className="text-xs font-semibold text-[#493a45]">
              Agregar nueva variante para &ldquo;{product.name}&rdquo;
            </h4>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-[#917987] hover:text-[#493a45] cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
          <VariantFormInline
            productId={product.id}
            role={role}
            basePrice={product.basePrice}
            onSuccess={() => {
              setIsAdding(false);
              queryClient.invalidateQueries({ queryKey: ['admin-product', product.id] });
              queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
            }}
            onCancel={() => setIsAdding(false)}
          />
        </div>
      )}

      {/* Formulario INLINE para Editar Variante (Reemplaza al modal anidado) */}
      {editingVariant && (
        <div className="border border-[#764b77]/30 bg-[#fbf9fb] p-4.5 rounded shadow-xs">
          <div className="mb-3 flex items-center justify-between border-b border-[#ebddeb] pb-2.5">
            <h4 className="text-xs font-semibold text-[#493a45]">
              Editar variante: {editingVariant.name} ({editingVariant.sku})
            </h4>
            <button
              type="button"
              onClick={() => setEditingVariant(null)}
              className="text-[#917987] hover:text-[#493a45] cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
          <VariantFormInline
            productId={product.id}
            variant={editingVariant}
            role={role}
            basePrice={product.basePrice}
            onSuccess={() => {
              setEditingVariant(null);
              queryClient.invalidateQueries({ queryKey: ['admin-product', product.id] });
              queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
            }}
            onCancel={() => setEditingVariant(null)}
          />
        </div>
      )}

      {/* Tabla de variantes */}
      {product.variants.length === 0 ? (
        <div className="rounded border border-[#eee8ed] bg-[#fbf9fa] p-8 text-center text-[11px] text-[#948692]">
          <Package size={28} className="mx-auto mb-2 text-[#c4b7c1]" />
          <p className="font-medium text-[#493a45]">Este producto aún no tiene variantes</p>
          <p className="mt-1 text-[10px]">
            Un producto requiere al menos una variante con existencias para poder venderse en la tienda.
          </p>
          {!isAdding && (
            <Button size="sm" onClick={() => setIsAdding(true)} className="mt-3">
              <Plus size={13} className="mr-1" /> Agregar primera variante
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#eee8ed]">
          <table className="w-full border-collapse bg-white">
            <thead>
              <tr>
                <th className={th}>Tono / Presentación</th>
                <th className={th}>SKU</th>
                <th className={th}>Precio venta</th>
                {role === 'ADMIN' && <th className={th}>Costo (Admin)</th>}
                <th className={th}>Existencias</th>
                <th className={th}>Estado</th>
                <th className={`${th} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => {
                const isLowStock =
                  v.lowStockThreshold !== null && v.stock <= v.lowStockThreshold;

                return (
                  <tr key={v.id} className="hover:bg-[#faf8f9] transition-colors">
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        {v.colorHex ? (
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border border-black/20 shadow-xs"
                            style={{ backgroundColor: v.colorHex }}
                            title={`Tono: ${v.colorHex}`}
                          />
                        ) : (
                          <span className="h-4 w-4 shrink-0 rounded-full border border-dashed border-[#c5bcc3]" />
                        )}
                        <span className="font-medium text-[#493a45]">{v.name}</span>
                      </div>
                    </td>
                    <td className={td}>
                      <span className="font-mono text-[10px] font-semibold text-[#625760]">
                        {v.sku}
                      </span>
                    </td>
                    <td className={td}>
                      {v.price !== null ? (
                        <div>
                          <strong className="text-[#493a45]">{formatCOP(v.price)}</strong>
                          <span className="block text-[8px] text-[#a0929b]">Precio propio</span>
                        </div>
                      ) : (
                        <div>
                          <span>{formatCOP(product.basePrice)}</span>
                          <span className="block text-[8px] text-[#a0929b]">Hereda precio base</span>
                        </div>
                      )}
                    </td>
                    {role === 'ADMIN' && (
                      <td className={td}>
                        {v.costPrice !== null && v.costPrice !== undefined ? (
                          formatCOP(v.costPrice)
                        ) : (
                          <span className="text-[#a0929b]">—</span>
                        )}
                      </td>
                    )}
                    <td className={td}>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-semibold ${
                            v.stock === 0
                              ? 'text-danger'
                              : isLowStock
                                ? 'text-amber-700'
                                : 'text-[#493a45]'
                          }`}
                        >
                          {v.stock} un.
                        </span>
                        {isLowStock && (
                          <span
                            title={`Stock bajo (umbral: ${v.lowStockThreshold})`}
                            className="text-amber-600"
                          >
                            <AlertCircle size={13} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      <AdminStatus tone={v.isActive ? 'ok' : 'out'}>
                        {v.isActive ? 'Activa' : 'Inactiva'}
                      </AdminStatus>
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsAdding(false);
                            setEditingVariant(v);
                          }}
                          aria-label={`Editar variante ${v.name}`}
                        >
                          <Edit2 size={12} className="mr-1" /> Editar
                        </Button>
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
                            if (confirm(`¿Eliminar variante "${v.name}" (${v.sku}) definitivamente?`)) {
                              deleteVariant.mutate(v.id);
                            }
                          }}
                          disabled={deleteVariant.isPending}
                          className="text-danger hover:border-danger hover:bg-danger-bg cursor-pointer"
                          aria-label={`Eliminar variante ${v.name}`}
                        >
                          <Trash2 size={12} className="mr-1" /> Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Formulario inline para variantes (creación o edición) */
function VariantFormInline({
  productId,
  variant,
  role,
  basePrice,
  onSuccess,
  onCancel,
}: {
  productId: string;
  variant?: ProductVariant;
  role: AdminRole;
  basePrice: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(variant);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateVariantValues | UpdateVariantValues>({
    resolver: zodResolver(isEditing ? updateVariantSchema : createVariantSchema),
    defaultValues: {
      sku: variant?.sku ?? '',
      name: variant?.name ?? '',
      colorHex: variant?.colorHex ?? '',
      price: variant?.price !== null && variant?.price !== undefined ? String(variant.price) : '',
      costPrice:
        variant?.costPrice !== null && variant?.costPrice !== undefined
          ? String(variant.costPrice)
          : '',
      maxPerOrder: variant?.maxPerOrder ? String(variant.maxPerOrder) : '',
      lowStockThreshold:
        variant?.lowStockThreshold !== null && variant?.lowStockThreshold !== undefined
          ? String(variant.lowStockThreshold)
          : '',
    },
  });

  const currentColorHex = watch('colorHex');

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing && variant) {
        await apiFetch<ProductVariant>(`/admin/products/${productId}/variants/${variant.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: values.name,
            colorHex: values.colorHex || undefined,
            price: toNullableNumber(values.price),
            costPrice: role === 'ADMIN' ? toNullableNumber(values.costPrice) : undefined,
            maxPerOrder: toNullableNumber(values.maxPerOrder),
            lowStockThreshold: toNullableNumber(values.lowStockThreshold),
          }),
        });
        toast.success('Variante actualizada.');
      } else {
        const createVals = values as CreateVariantValues;
        await apiFetch<ProductVariant>(`/admin/products/${productId}/variants`, {
          method: 'POST',
          body: JSON.stringify({
            sku: createVals.sku,
            name: createVals.name,
            colorHex: createVals.colorHex || undefined,
            price: toNullableNumber(createVals.price),
            costPrice: role === 'ADMIN' ? toNullableNumber(createVals.costPrice) : undefined,
            maxPerOrder: toNullableNumber(createVals.maxPerOrder),
            lowStockThreshold: toNullableNumber(createVals.lowStockThreshold),
          }),
        });
        toast.success('Variante creada exitosamente.');
      }
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar la variante.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3.5">
      <div className="grid gap-x-4 gap-y-3 min-[601px]:grid-cols-2">
        {!isEditing ? (
          <FormField
            id="v-sku"
            label="SKU (Identificador único) *"
            description="Código único en mayúsculas, ej. LIP-RED-01"
            error={(errors as Record<string, { message?: string }>).sku?.message}
          >
            <Input
              placeholder="Ej. LIP-RED-01"
              {...fieldA11y('v-sku', (errors as Record<string, { message?: string }>).sku?.message)}
              {...register('sku' as 'name')}
            />
          </FormField>
        ) : (
          <div className="flex flex-col space-y-1">
            <span className="text-[11px] font-semibold text-[#493a45]">SKU</span>
            <div className="p-2 border border-[#eee8ed] bg-[#f8f5f7] text-[11px] font-mono text-[#766a73]">
              {variant?.sku} (No modificable)
            </div>
          </div>
        )}

        <FormField id="v-name" label="Nombre o tono *" error={errors.name?.message}>
          <Input
            placeholder="Ej. 01 Rojo Pasión, 05 Nude Rosado"
            {...fieldA11y('v-name', errors.name?.message)}
            {...register('name')}
          />
        </FormField>

        <FormField
          id="v-color"
          label="Color de muestra (Hexadecimal opcional)"
          description="Formato #RRGGBB para mostrar muestra visual del tono."
          error={errors.colorHex?.message}
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentColorHex && /^#[0-9A-Fa-f]{6}$/.test(currentColorHex) ? currentColorHex : '#d885a3'}
              onChange={(e) => setValue('colorHex', e.target.value.toUpperCase())}
              aria-label="Selector interactivo de color"
              className="h-8.5 w-10 cursor-pointer border border-[#e8dfe6] bg-white p-0.5"
            />
            <Input
              placeholder="#E57373"
              className="uppercase"
              {...fieldA11y('v-color', errors.colorHex?.message)}
              {...register('colorHex')}
            />
          </div>
        </FormField>

        <FormField
          id="v-price"
          label="Precio en COP (opcional)"
          description={`Si se deja vacío, hereda el precio base: ${formatCOP(basePrice)}`}
          error={errors.price?.message}
        >
          <Input
            type="number"
            min={0}
            step={100}
            placeholder={`Hereda ${formatCOP(basePrice)}`}
            {...fieldA11y('v-price', errors.price?.message)}
            {...register('price')}
          />
        </FormField>

        {role === 'ADMIN' && (
          <FormField
            id="v-cost"
            label="Precio de costo COP (solo Admin)"
            description="Uso contable interno, no visible para clientes ni staff."
            error={errors.costPrice?.message}
          >
            <Input
              type="number"
              min={0}
              step={100}
              placeholder="Ej. 18000"
              {...fieldA11y('v-cost', errors.costPrice?.message)}
              {...register('costPrice')}
            />
          </FormField>
        )}

        <FormField
          id="v-threshold"
          label="Umbral de stock bajo"
          description="Alerta cuando las existencias alcancen este número."
          error={errors.lowStockThreshold?.message}
        >
          <Input
            type="number"
            min={0}
            placeholder="Ej. 3"
            {...fieldA11y('v-threshold', errors.lowStockThreshold?.message)}
            {...register('lowStockThreshold')}
          />
        </FormField>

        <FormField
          id="v-maxOrder"
          label="Máximo por pedido"
          description="Límite máximo de compra por carrito (opcional)."
          error={errors.maxPerOrder?.message}
        >
          <Input
            type="number"
            min={1}
            placeholder="Ej. 6"
            {...fieldA11y('v-maxOrder', errors.maxPerOrder?.message)}
            {...register('maxPerOrder')}
          />
        </FormField>
      </div>

      <div className="flex justify-end gap-2.5 pt-3 border-t border-[#f0ecf0]">
        <Button variant="outline" size="sm" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button size="sm" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : isEditing ? 'Actualizar variante' : 'Crear variante'}
        </Button>
      </div>
    </form>
  );
}

/** Pestaña 2: Edición de información general y precios */
function ProductInfoTab({
  product,
  brands,
  validCategories,
}: {
  product: Product;
  brands: Brand[];
  validCategories: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProductValues>({
    resolver: zodResolver(updateProductSchema),
    defaultValues: {
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription ?? '',
      description: product.description,
      brandId: product.brandId,
      categoryId: product.categoryId,
      netContent: product.netContent ?? '',
      basePrice: String(product.basePrice),
      isFeatured: product.isFeatured,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<Product>(`/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          slug: values.slug || undefined,
          shortDescription: values.shortDescription || undefined,
          description: values.description,
          brandId: values.brandId,
          categoryId: values.categoryId,
          netContent: values.netContent || undefined,
          basePrice: values.basePrice ? Number(values.basePrice) : undefined,
          isFeatured: values.isFeatured,
        }),
      });
      toast.success('Información del producto actualizada.');
      await queryClient.invalidateQueries({ queryKey: ['admin-product', product.id] });
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo actualizar el producto.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-x-4 gap-y-3 min-[601px]:grid-cols-2">
        <FormField id="ep-name" label="Nombre del producto *" error={errors.name?.message}>
          <Input {...fieldA11y('ep-name', errors.name?.message)} {...register('name')} />
        </FormField>

        <FormField id="ep-brand" label="Marca *" error={errors.brandId?.message}>
          <Select {...fieldA11y('ep-brand', errors.brandId?.message)} {...register('brandId')}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="ep-cat" label="Categoría *" error={errors.categoryId?.message}>
          <Select {...fieldA11y('ep-cat', errors.categoryId?.message)} {...register('categoryId')}>
            {validCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          id="ep-price"
          label="Precio base en COP *"
          description="Al cambiar este precio, se actualiza el historial de precios para variantes que heredan este valor."
          error={errors.basePrice?.message}
        >
          <Input
            type="number"
            min={0}
            step={100}
            {...fieldA11y('ep-price', errors.basePrice?.message)}
            {...register('basePrice')}
          />
        </FormField>

        <FormField id="ep-slug" label="Slug URL" error={errors.slug?.message}>
          <Input {...fieldA11y('ep-slug', errors.slug?.message)} {...register('slug')} />
        </FormField>

        <FormField id="ep-netContent" label="Contenido neto (opcional)" error={errors.netContent?.message}>
          <Input {...fieldA11y('ep-netContent', errors.netContent?.message)} {...register('netContent')} />
        </FormField>

        <FormField
          id="ep-shortDesc"
          label="Descripción corta"
          className="min-[601px]:col-span-2"
          error={errors.shortDescription?.message}
        >
          <Input
            placeholder="Resumen para tarjetas comerciales"
            {...fieldA11y('ep-shortDesc', errors.shortDescription?.message)}
            {...register('shortDescription')}
          />
        </FormField>

        <FormField
          id="ep-desc"
          label="Descripción detallada *"
          className="min-[601px]:col-span-2"
          error={errors.description?.message}
        >
          <Textarea
            rows={4}
            {...fieldA11y('ep-desc', errors.description?.message)}
            {...register('description')}
          />
        </FormField>
      </div>

      <div className="flex items-center justify-between border-t border-[#f0ecf0] pt-3">
        <label className="flex items-center gap-2 text-[11px] text-[#493a45] cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-[#c5bcc3]"
            {...register('isFeatured')}
          />
          <span>Destacar este producto en la página principal</span>
        </label>

        <Button size="sm" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

/** Pestaña 3: Publicación, cambio de estado y eliminación */
function ProductStatusTab({
  product,
  onDeleted,
}: {
  product: Product;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();

  const changeStatus = useMutation({
    mutationFn: (newStatus: ProductStatus) =>
      apiFetch<Product>(`/admin/products/${product.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: async (updated) => {
      toast.success(`Estado cambiado a ${PRODUCT_STATUS_LABELS[updated.status]}.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-product', product.id] });
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar el estado.')),
  });

  const deleteProduct = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/admin/products/${product.id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      toast.success('Producto eliminado del catálogo.');
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      onDeleted();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar el producto.')),
  });

  return (
    <div className="space-y-4">
      {/* Tarjeta explicativa de estado actual */}
      <div className="border border-[#eee8ed] bg-[#fcfbfa] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-[#493a45]">Estado actual del producto</h4>
            <p className="mt-1 text-[11px] text-[#625760]">
              {product.status === 'ACTIVE' &&
                'Este producto está publicado y visible para los clientes en la tienda online.'}
              {product.status === 'DRAFT' &&
                'Este producto es un borrador; no es visible públicamente en el catálogo.'}
              {product.status === 'INACTIVE' &&
                'Este producto está pausado; temporalmente oculto de la tienda.'}
              {product.status === 'ARCHIVED' &&
                'Este producto está archivado; retirado permanentemente para nuevas compras pero conservando pedidos anteriores.'}
            </p>
          </div>
          <ProductStatusBadge status={product.status} />
        </div>

        {/* Acciones de transición de estado */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-[#f0ecf0] pt-3.5">
          {product.status !== 'ACTIVE' && (
            <Button
              size="sm"
              onClick={() => changeStatus.mutate('ACTIVE')}
              disabled={changeStatus.isPending}
            >
              <CheckCircle2 size={13} className="mr-1.5" />
              Publicar / Activar en tienda
            </Button>
          )}

          {product.status === 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeStatus.mutate('INACTIVE')}
              disabled={changeStatus.isPending}
            >
              Pausar / Desactivar (Ocultar)
            </Button>
          )}

          {product.status !== 'ARCHIVED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    '¿Deseas archivar este producto? Conservará todo su historial de pedidos pero dejará de estar disponible.',
                  )
                ) {
                  changeStatus.mutate('ARCHIVED');
                }
              }}
              disabled={changeStatus.isPending}
            >
              <Archive size={13} className="mr-1.5" />
              Archivar producto
            </Button>
          )}
        </div>
      </div>

      {/* Zona de peligro: Eliminación física */}
      <div className="border border-red-200 bg-red-50/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold text-red-900">Zona de peligro: Eliminación física</h4>
            <p className="mt-1 text-[11px] text-red-700">
              Solo es posible eliminar un producto si nunca ha tenido pedidos registrados. Si ya tiene pedidos asociados, el sistema requerirá que sea archivado en lugar de eliminado para salvaguardar la contabilidad.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  `¿Estás completamente seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`,
                )
              ) {
                deleteProduct.mutate();
              }
            }}
            disabled={deleteProduct.isPending}
            className="border-red-300 text-danger hover:border-danger hover:bg-danger-bg shrink-0"
          >
            <Trash2 size={13} className="mr-1.5" />
            Eliminar definitivamente
          </Button>
        </div>
      </div>
    </div>
  );
}
