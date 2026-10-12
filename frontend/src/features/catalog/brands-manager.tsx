'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { createBrandSchema, type CreateBrandValues } from '@/schemas/catalog';
import type { Brand } from '@/types/catalog';

export const BRANDS_KEY = ['admin-brands'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function BrandsManager() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const {
    data: brands,
    isPending,
    isError,
  } = useQuery({
    queryKey: BRANDS_KEY,
    queryFn: () => apiFetch<Brand[]>('/admin/brands'),
  });

  const visible = brands?.filter((b) =>
    b.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <CreateBrandForm />

      <AdminPanel>
        <div className="mb-3.5 flex items-center justify-between gap-5 max-[600px]:flex-col max-[600px]:items-start">
          <AdminPanelTitle className="mb-0">Marcas registradas</AdminPanelTitle>
          <label className="flex items-center gap-2.5 border border-[#e8dfe6] p-2.5 text-[#917987] max-[600px]:w-full">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar marcas"
              aria-label="Buscar marcas"
              className="border-0 text-[11px] outline-0 max-[600px]:w-full"
            />
          </label>
        </div>

        {isPending && <p className="text-[11px] text-muted">Cargando marcas…</p>}
        {isError && <p className="text-[11px] text-danger">No se pudieron cargar las marcas.</p>}

        {visible && visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 bg-[#fbf9fa] px-5 py-12.5 text-center text-[11px] text-[#948692]">
            <Tag size={32} /> No hay marcas que coincidan con la búsqueda.
          </div>
        )}

        {visible && visible.length > 0 && (
          <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
            {visible.map((brand) => (
              <BrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}

function CreateBrandForm() {
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
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear la marca.'));
    }
  });

  return (
    <AdminPanel>
      <AdminPanelTitle>Nueva marca</AdminPanelTitle>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-x-4.5 min-[601px]:grid-cols-2">
          <FormField id="brand-name" label="Nombre de la marca" error={errors.name?.message}>
            <Input
              placeholder="Ej. Maybelline, Vogue, Trendy"
              {...fieldA11y('brand-name', errors.name?.message)}
              {...register('name')}
            />
          </FormField>
          <FormField
            id="brand-slug"
            label="Slug (opcional)"
            description="Si se deja vacío, se genera automáticamente del nombre."
            error={errors.slug?.message}
          >
            <Input
              placeholder="ej-vogue"
              {...fieldA11y('brand-slug', errors.slug?.message)}
              {...register('slug')}
            />
          </FormField>
        </div>
        <Button type="submit" className="mt-2" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear marca'}
        </Button>
      </form>
    </AdminPanel>
  );
}

function BrandCard({ brand }: { brand: Brand }) {
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: () =>
      apiFetch<Brand>(`/admin/brands/${brand.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !brand.isActive }),
      }),
    onSuccess: async () => {
      toast.success(brand.isActive ? 'Marca desactivada.' : 'Marca activada.');
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
    <div className="flex flex-col justify-between gap-3 border border-[#eee8ed] bg-[#fbf9fa] p-4.75">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#493a45]">{brand.name}</span>
          <AdminStatus tone={brand.isActive ? 'ok' : 'out'}>
            {brand.isActive ? 'Activa' : 'Inactiva'}
          </AdminStatus>
        </div>
        <small className="mt-1 block text-[10px] text-[#a0929b]">
          Slug: <span className="font-mono text-[9px]">{brand.slug}</span> · {brand.productCount} productos asociados
        </small>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[#f0ecf0] pt-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleActive.mutate()}
          disabled={toggleActive.isPending}
        >
          {brand.isActive ? 'Desactivar' : 'Activar'}
        </Button>

        {brand.productCount === 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`¿Estás seguro de eliminar la marca "${brand.name}"?`)) {
                deleteBrand.mutate();
              }
            }}
            disabled={deleteBrand.isPending}
            className="text-danger hover:border-danger hover:bg-danger-bg"
            aria-label="Eliminar marca"
          >
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}
