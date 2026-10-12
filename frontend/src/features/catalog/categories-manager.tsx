'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, CornerDownRight, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { createCategorySchema, type CreateCategoryValues } from '@/schemas/catalog';
import type { Category } from '@/types/catalog';

export const CATEGORIES_KEY = ['admin-categories'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function CategoriesManager() {
  const {
    data: categories,
    isPending,
    isError,
  } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => apiFetch<Category[]>('/admin/categories'),
  });

  return (
    <div className="space-y-5">
      <CreateCategoryForm rootCategories={categories ?? []} />

      <AdminPanel>
        <AdminPanelTitle>Estructura de categorías (máximo 2 niveles)</AdminPanelTitle>

        {isPending && <p className="text-[11px] text-muted">Cargando categorías…</p>}
        {isError && <p className="text-[11px] text-danger">No se pudieron cargar las categorías.</p>}

        {categories && categories.length === 0 && (
          <div className="flex flex-col items-center gap-3 bg-[#fbf9fa] px-5 py-12.5 text-center text-[11px] text-[#948692]">
            <Boxes size={32} /> No hay categorías creadas todavía.
          </div>
        )}

        {categories && categories.length > 0 && (
          <div className="space-y-4">
            {categories.map((cat) => (
              <CategoryTreeItem key={cat.id} category={cat} />
            ))}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}

function CreateCategoryForm({ rootCategories }: { rootCategories: Category[] }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { position: '0', isActive: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<Category>('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          slug: values.slug || undefined,
          parentId: values.parentId || undefined,
          description: values.description || undefined,
          position: values.position ? Number(values.position) : 0,
          isActive: values.isActive,
        }),
      });
      reset();
      toast.success('Categoría creada exitosamente.');
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear la categoría.'));
    }
  });

  return (
    <AdminPanel>
      <AdminPanelTitle>Nueva categoría o subcategoría</AdminPanelTitle>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-x-4.5 min-[601px]:grid-cols-2">
          <FormField id="cat-name" label="Nombre" error={errors.name?.message}>
            <Input
              placeholder="Ej. Labios, Rostro, Labiales mate"
              {...fieldA11y('cat-name', errors.name?.message)}
              {...register('name')}
            />
          </FormField>

          <FormField
            id="cat-parent"
            label="Categoría padre (opcional)"
            description="Déjalo vacío para crear una categoría principal."
            error={errors.parentId?.message}
          >
            <Select {...fieldA11y('cat-parent', errors.parentId?.message)} {...register('parentId')}>
              <option value="">(Ninguna — es categoría principal)</option>
              {rootCategories.map((rc) => (
                <option key={rc.id} value={rc.id}>
                  {rc.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="cat-slug"
            label="Slug (opcional)"
            description="Si se deja vacío, se genera automáticamente."
            error={errors.slug?.message}
          >
            <Input
              placeholder="ej-labios-mate"
              {...fieldA11y('cat-slug', errors.slug?.message)}
              {...register('slug')}
            />
          </FormField>

          <FormField
            id="cat-position"
            label="Posición / orden"
            description="Número para ordenar en la tienda (0 primero)."
            error={errors.position?.message}
          >
            <Input
              type="number"
              min={0}
              {...fieldA11y('cat-position', errors.position?.message)}
              {...register('position')}
            />
          </FormField>
        </div>

        <Button type="submit" className="mt-2" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear categoría'}
        </Button>
      </form>
    </AdminPanel>
  );
}

function CategoryTreeItem({ category }: { category: Category }) {
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: (cat: Category) =>
      apiFetch<Category>(`/admin/categories/${cat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !cat.isActive }),
      }),
    onSuccess: async (_, variables) => {
      toast.success(variables.isActive ? 'Categoría desactivada.' : 'Categoría activada.');
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo actualizar la categoría.')),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/categories/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      toast.success('Categoría eliminada.');
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar la categoría.')),
  });

  return (
    <div className="border border-[#eee8ed] bg-[#fbf9fa] p-4">
      {/* Nivel 1: Categoría Principal */}
      <div className="flex items-center justify-between gap-3 max-[600px]:flex-col max-[600px]:items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#493a45]">{category.name}</span>
            <AdminStatus tone={category.isActive ? 'ok' : 'out'}>
              {category.isActive ? 'Activa' : 'Inactiva'}
            </AdminStatus>
          </div>
          <small className="mt-0.5 block text-[10px] text-[#a0929b]">
            Slug: <span className="font-mono text-[9px]">{category.slug}</span> · Posición: {category.position} · Subcategorías: {category.children.length}
          </small>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleActive.mutate(category)}
            disabled={toggleActive.isPending}
          >
            {category.isActive ? 'Desactivar' : 'Activar'}
          </Button>

          {category.children.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm(`¿Estás seguro de eliminar "${category.name}"?`)) {
                  deleteCategory.mutate(category.id);
                }
              }}
              disabled={deleteCategory.isPending}
              className="text-danger hover:border-danger hover:bg-danger-bg"
              aria-label="Eliminar categoría"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      {/* Nivel 2: Subcategorías */}
      {category.children.length > 0 && (
        <div className="mt-3.5 space-y-2 border-t border-[#ede7eb] pt-3 pl-3">
          {category.children.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between gap-3 rounded bg-white p-2.5 border border-[#f0ecf0]"
            >
              <div className="flex items-center gap-2">
                <CornerDownRight size={14} className="text-[#a4979e]" />
                <div>
                  <span className="text-xs font-medium text-[#493a45]">{sub.name}</span>
                  <small className="ml-2 font-mono text-[9px] text-[#a0929b]">{sub.slug}</small>
                </div>
                <AdminStatus tone={sub.isActive ? 'ok' : 'out'}>
                  {sub.isActive ? 'Activa' : 'Inactiva'}
                </AdminStatus>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive.mutate(sub)}
                  disabled={toggleActive.isPending}
                >
                  {sub.isActive ? 'Desactivar' : 'Activar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`¿Estás seguro de eliminar "${sub.name}"?`)) {
                      deleteCategory.mutate(sub.id);
                    }
                  }}
                  disabled={deleteCategory.isPending}
                  className="text-danger hover:border-danger hover:bg-danger-bg"
                  aria-label="Eliminar subcategoría"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
