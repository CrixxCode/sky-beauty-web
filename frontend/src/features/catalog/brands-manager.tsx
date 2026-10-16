'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Modal } from '@/components/ui/modal';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import {
  createBrandSchema,
  updateBrandSchema,
  type CreateBrandValues,
  type UpdateBrandValues,
} from '@/schemas/catalog';
import type { Brand } from '@/types/catalog';

export const BRANDS_KEY = ['admin-brands'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/** `canDelete`: eliminar es exclusivo de la propietaria (Context/decisiones.md). */
export function BrandsManager({ canDelete }: { canDelete: boolean }) {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  const {
    data: brands,
    isPending,
    isError,
  } = useQuery({
    queryKey: BRANDS_KEY,
    queryFn: () => apiFetch<Brand[]>('/admin/brands'),
  });

  const visible = brands?.filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-5">
      <AdminPanel>
        {/* Barra superior con título y controles */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AdminPanelTitle className="mb-0">Marcas registradas</AdminPanelTitle>
            {brands && (
              <Badge>
                {brands.length} {brands.length === 1 ? 'marca' : 'marcas'}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 max-[600px]:w-full">
            <InputGroup className="max-[600px]:w-full">
              <InputGroupAddon>
                <Search size={15} />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                aria-label="Buscar marcas"
                className="w-48 flex-none max-[600px]:w-full max-[600px]:flex-1"
              />
              {search && (
                <InputGroupButton onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                  <X size={14} />
                </InputGroupButton>
              )}
            </InputGroup>

            <Button onClick={() => setIsCreateOpen(true)} className="max-[600px]:w-full">
              <Plus size={15} className="mr-1.5" /> Crear marca
            </Button>
          </div>
        </div>

        {isPending && <p className="text-[11px] text-muted">Cargando marcas…</p>}
        {isError && <p className="text-[11px] text-danger">No se pudieron cargar las marcas.</p>}

        {visible && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2.5 bg-[#fbf9fa] border border-[#eee8ed] px-5 py-12 text-center text-[11px] text-[#948692]">
            <Tag size={32} className="text-[#c4b7c1]" />
            <p className="font-medium text-[#493a45]">
              {search ? 'No se encontraron marcas' : 'No hay marcas registradas'}
            </p>
            <p className="text-[10px]">
              {search
                ? `No hay resultados que coincidan con "${search}".`
                : 'Registra tu primera marca para empezar a clasificar tus productos.'}
            </p>
          </div>
        )}

        {visible && visible.length > 0 && (
          <div className="grid grid-cols-2 gap-3.5 max-[768px]:grid-cols-1">
            {visible.map((brand) => (
              <BrandCard
                key={brand.id}
                brand={brand}
                canDelete={canDelete}
                onEdit={() => setEditingBrand(brand)}
              />
            ))}
          </div>
        )}
      </AdminPanel>

      {/* Modal para Crear Marca */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Nueva marca"
        description="Ingresa los datos para registrar una nueva marca de maquillaje o cosméticos."
      >
        <CreateBrandForm
          onSuccess={() => setIsCreateOpen(false)}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      {/* Modal para Editar Marca */}
      <Modal
        isOpen={!!editingBrand}
        onClose={() => setEditingBrand(null)}
        title={`Editar marca: ${editingBrand?.name}`}
        description="Modifica los datos de la marca seleccionada."
      >
        {editingBrand && (
          <EditBrandForm
            brand={editingBrand}
            onSuccess={() => setEditingBrand(null)}
            onCancel={() => setEditingBrand(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function CreateBrandForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateBrandValues>({ resolver: zodResolver(createBrandSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<Brand>('/admin/brands', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          slug: values.slug || undefined,
        }),
      });
      reset();
      toast.success('Marca creada exitosamente.');
      await queryClient.invalidateQueries({ queryKey: BRANDS_KEY });
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear la marca.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="brand-name" label="Nombre de la marca *" error={errors.name?.message}>
        <Input
          placeholder="Ej. Maybelline, Vogue, Trendy"
          {...fieldA11y('brand-name', errors.name?.message)}
          {...register('name')}
        />
      </FormField>

      <FormField
        id="brand-slug"
        label="Slug URL (opcional)"
        description="Identificador en la URL. Si lo dejas vacío, se generará a partir del nombre."
        error={errors.slug?.message}
      >
        <Input
          placeholder="ej-vogue"
          {...fieldA11y('brand-slug', errors.slug?.message)}
          {...register('slug')}
        />
      </FormField>

      <div className="flex justify-end gap-2.5 pt-3 border-t border-[#f0ecf0]">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear marca'}
        </Button>
      </div>
    </form>
  );
}

function EditBrandForm({
  brand,
  onSuccess,
  onCancel,
}: {
  brand: Brand;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateBrandValues>({
    resolver: zodResolver(updateBrandSchema),
    defaultValues: {
      name: brand.name,
      slug: brand.slug,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<Brand>(`/admin/brands/${brand.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          slug: values.slug || undefined,
        }),
      });
      toast.success('Marca actualizada exitosamente.');
      await queryClient.invalidateQueries({ queryKey: BRANDS_KEY });
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo actualizar la marca.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="edit-brand-name" label="Nombre de la marca *" error={errors.name?.message}>
        <Input {...fieldA11y('edit-brand-name', errors.name?.message)} {...register('name')} />
      </FormField>

      <FormField
        id="edit-brand-slug"
        label="Slug URL"
        description="Identificador único en la URL."
        error={errors.slug?.message}
      >
        <Input {...fieldA11y('edit-brand-slug', errors.slug?.message)} {...register('slug')} />
      </FormField>

      <div className="flex justify-end gap-2.5 pt-3 border-t border-[#f0ecf0]">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

function BrandCard({
  brand,
  canDelete,
  onEdit,
}: {
  brand: Brand;
  canDelete: boolean;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const toggleActive = useMutation({
    mutationFn: () =>
      apiFetch<Brand>(`/admin/brands/${brand.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !brand.isActive }),
      }),
    onSuccess: async () => {
      toast.success(
        brand.isActive
          ? 'Marca desactivada. Sus productos dejan de mostrarse en la tienda.'
          : 'Marca activada.',
      );
      await queryClient.invalidateQueries({ queryKey: BRANDS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo actualizar la marca.')),
  });

  const deleteBrand = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/admin/brands/${brand.id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      toast.success('Marca eliminada.');
      await queryClient.invalidateQueries({ queryKey: BRANDS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar la marca.')),
  });

  return (
    <Card className="flex flex-col justify-between transition-shadow hover:shadow-xs">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#f4eff3] text-[#936591]">
              <Tag size={15} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#493a45]">{brand.name}</span>
              <small className="block font-mono text-[9px] text-[#6d646a]">/{brand.slug}</small>
            </div>
          </div>
          <AdminStatus tone={brand.isActive ? 'ok' : 'out'}>
            {brand.isActive ? 'Activa' : 'Inactiva'}
          </AdminStatus>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-[#766a73]">
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-[#493a45]">{brand.productCount}</span>
            {brand.productCount === 1 ? 'producto asociado' : 'productos asociados'}
          </span>
        </div>
      </CardContent>

      <CardFooter className="mt-auto justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit2 size={12} className="mr-1" /> Editar
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleActive.mutate()}
          disabled={toggleActive.isPending}
        >
          {brand.isActive ? 'Desactivar' : 'Activar'}
        </Button>

        {!canDelete ? null : brand.productCount === 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteBrand.isPending}
            className="text-danger hover:border-danger hover:bg-danger-bg cursor-pointer"
            aria-label={`Eliminar marca ${brand.name}`}
          >
            <Trash2 size={13} className="mr-1" /> Eliminar
          </Button>
        ) : (
          <span
            title="No se puede eliminar porque tiene productos asociados"
            className="inline-flex cursor-not-allowed items-center rounded border border-[#eee8ed] p-1.5 text-[#c2b6be]"
          >
            <Trash2 size={13} />
          </span>
        )}
      </CardFooter>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar marca"
        description={`Esta acción eliminará la marca "${brand.name}". Solo está disponible porque no tiene productos asociados.`}
        confirmLabel={deleteBrand.isPending ? 'Eliminando...' : 'Eliminar marca'}
        destructive
        onConfirm={() => deleteBrand.mutate()}
      />
    </Card>
  );
}
