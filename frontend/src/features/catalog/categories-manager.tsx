'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, CornerDownRight, Edit2, FolderTree, Plus, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryValues,
  type UpdateCategoryValues,
} from '@/schemas/catalog';
import type { Category } from '@/types/catalog';

export const CATEGORIES_KEY = ['admin-categories'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/** `canDelete`: eliminar es exclusivo de la propietaria (Context/decisiones.md). */
export function CategoriesManager({ canDelete }: { canDelete: boolean }) {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [preselectedParentId, setPreselectedParentId] = useState<string | undefined>(undefined);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const {
    data: categories,
    isPending,
    isError,
  } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => apiFetch<Category[]>('/admin/categories'),
  });

  const handleOpenCreateWithParent = (parentId?: string) => {
    setPreselectedParentId(parentId);
    setIsCreateOpen(true);
  };

  // Filtrado de árbol por búsqueda
  const filteredCategories = categories?.filter((cat) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const matchesParent = cat.name.toLowerCase().includes(q) || cat.slug.toLowerCase().includes(q);
    const matchesChild = cat.children.some(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
    return matchesParent || matchesChild;
  });

  const totalCategoriesCount =
    (categories?.length ?? 0) +
    (categories?.reduce((acc, c) => acc + (c.children?.length ?? 0), 0) ?? 0);

  return (
    <div className="space-y-5">
      <AdminPanel>
        {/* Barra superior con título y controles */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AdminPanelTitle className="mb-0">Estructura de categorías</AdminPanelTitle>
            {categories && <Badge>{totalCategoriesCount} categorías en catálogo</Badge>}
          </div>

          <div className="flex flex-wrap items-center gap-3 max-[600px]:w-full">
            <InputGroup className="max-[600px]:w-full">
              <InputGroupAddon>
                <Search size={15} />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar categoría..."
                aria-label="Buscar categoría"
                className="w-48 flex-none max-[600px]:w-full max-[600px]:flex-1"
              />
              {search && (
                <InputGroupButton onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                  <X size={14} />
                </InputGroupButton>
              )}
            </InputGroup>

            <Button
              onClick={() => handleOpenCreateWithParent(undefined)}
              className="max-[600px]:w-full"
            >
              <Plus size={15} className="mr-1.5" /> Crear categoría
            </Button>
          </div>
        </div>

        <p className="mb-4 text-[11px] text-[#6d646a]">
          Organización de hasta 2 niveles (Categoría principal → Subcategoría). Los productos solo
          pueden asignarse a subcategorías o a categorías principales que no tengan hijos.
        </p>

        {isPending && <p className="text-[11px] text-muted">Cargando categorías…</p>}
        {isError && (
          <p className="text-[11px] text-danger">No se pudieron cargar las categorías.</p>
        )}

        {filteredCategories && filteredCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2.5 bg-[#fbf9fa] border border-[#eee8ed] px-5 py-12 text-center text-[11px] text-[#948692]">
            <Boxes size={32} className="text-[#c4b7c1]" />
            <p className="font-medium text-[#493a45]">
              {search ? 'No se encontraron categorías' : 'No hay categorías creadas aún'}
            </p>
            <p className="text-[10px]">
              {search
                ? `No hay categorías que coincidan con "${search}".`
                : 'Crea tu primera categoría para organizar los productos de la tienda.'}
            </p>
          </div>
        )}

        {filteredCategories && filteredCategories.length > 0 && (
          <div className="space-y-4">
            {filteredCategories.map((cat) => (
              <CategoryTreeItem
                key={cat.id}
                category={cat}
                canDelete={canDelete}
                onEdit={(c) => setEditingCategory(c)}
                onAddSubcategory={(parentId) => handleOpenCreateWithParent(parentId)}
              />
            ))}
          </div>
        )}
      </AdminPanel>

      {/* Modal para Crear Categoría o Subcategoría */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setPreselectedParentId(undefined);
        }}
        title={preselectedParentId ? 'Nueva subcategoría' : 'Nueva categoría'}
        description="Ingresa los datos para registrar la categoría en el árbol comercial."
      >
        <CreateCategoryForm
          rootCategories={categories ?? []}
          initialParentId={preselectedParentId}
          onSuccess={() => {
            setIsCreateOpen(false);
            setPreselectedParentId(undefined);
          }}
          onCancel={() => {
            setIsCreateOpen(false);
            setPreselectedParentId(undefined);
          }}
        />
      </Modal>

      {/* Modal para Editar Categoría */}
      <Modal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title={`Editar: ${editingCategory?.name}`}
        description="Modifica los datos de la categoría o subcategoría seleccionada."
      >
        {editingCategory && (
          <EditCategoryForm
            category={editingCategory}
            onSuccess={() => setEditingCategory(null)}
            onCancel={() => setEditingCategory(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function CreateCategoryForm({
  rootCategories,
  initialParentId,
  onSuccess,
  onCancel,
}: {
  rootCategories: Category[];
  initialParentId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      parentId: initialParentId || '',
      position: '0',
      isActive: true,
    },
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
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear la categoría.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="cat-name" label="Nombre de la categoría *" error={errors.name?.message}>
        <Input
          placeholder="Ej. Labios, Rostro, Labiales mate"
          {...fieldA11y('cat-name', errors.name?.message)}
          {...register('name')}
        />
      </FormField>

      <FormField
        id="cat-parent"
        label="Nivel / Categoría padre"
        description="Selecciona una categoría si es subcategoría, o déjalo vacío para que sea categoría principal."
        error={errors.parentId?.message}
      >
        <Controller
          control={control}
          name="parentId"
          render={({ field }) => (
            <Select
              {...fieldA11y('cat-parent', errors.parentId?.message)}
              name={field.name}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
            >
              <option value="">(Ninguna — Categoría principal)</option>
              {rootCategories.map((rc) => (
                <option key={rc.id} value={rc.id}>
                  Subcategoría de: {rc.name}
                </option>
              ))}
            </Select>
          )}
        />
      </FormField>

      <div className="grid gap-x-4 min-[601px]:grid-cols-2">
        <FormField
          id="cat-slug"
          label="Slug URL (opcional)"
          description="Si se deja vacío, se generará del nombre."
          error={errors.slug?.message}
        >
          <Input
            placeholder="ej-labiales-mate"
            {...fieldA11y('cat-slug', errors.slug?.message)}
            {...register('slug')}
          />
        </FormField>

        <FormField
          id="cat-position"
          label="Orden de visualización"
          description="Número entero para ordenar (0 se muestra primero)."
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

      <FormField id="cat-desc" label="Descripción (opcional)" error={errors.description?.message}>
        <Textarea
          rows={3}
          placeholder="Descripción comercial para los clientes en la tienda..."
          {...fieldA11y('cat-desc', errors.description?.message)}
          {...register('description')}
        />
      </FormField>

      <div className="flex justify-end gap-2.5 pt-3 border-t border-[#f0ecf0]">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear categoría'}
        </Button>
      </div>
    </form>
  );
}

function EditCategoryForm({
  category,
  onSuccess,
  onCancel,
}: {
  category: Category;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCategoryValues>({
    resolver: zodResolver(updateCategorySchema),
    defaultValues: {
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      position: String(category.position),
      isActive: category.isActive,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<Category>(`/admin/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          slug: values.slug || undefined,
          description: values.description || undefined,
          position: values.position ? Number(values.position) : 0,
          isActive: values.isActive,
        }),
      });
      toast.success('Categoría actualizada exitosamente.');
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo actualizar la categoría.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="edit-cat-name" label="Nombre de la categoría *" error={errors.name?.message}>
        <Input {...fieldA11y('edit-cat-name', errors.name?.message)} {...register('name')} />
      </FormField>

      <div className="grid gap-x-4 min-[601px]:grid-cols-2">
        <FormField id="edit-cat-slug" label="Slug URL" error={errors.slug?.message}>
          <Input {...fieldA11y('edit-cat-slug', errors.slug?.message)} {...register('slug')} />
        </FormField>

        <FormField
          id="edit-cat-position"
          label="Orden de visualización"
          error={errors.position?.message}
        >
          <Input
            type="number"
            min={0}
            {...fieldA11y('edit-cat-position', errors.position?.message)}
            {...register('position')}
          />
        </FormField>
      </div>

      <FormField
        id="edit-cat-desc"
        label="Descripción (opcional)"
        error={errors.description?.message}
      >
        <Textarea
          rows={3}
          {...fieldA11y('edit-cat-desc', errors.description?.message)}
          {...register('description')}
        />
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

function CategoryTreeItem({
  category,
  canDelete,
  onEdit,
  onAddSubcategory,
}: {
  category: Category;
  canDelete: boolean;
  onEdit: (cat: Category) => void;
  onAddSubcategory: (parentId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

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
    <div className="border border-[#eee8ed] bg-white transition-shadow hover:shadow-xs">
      {/* Nivel 1: Categoría Principal */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#fdfbfc] border-b border-[#f0ecf0]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#f4eff3] text-[#764b77]">
            <FolderTree size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#493a45]">{category.name}</span>
              <AdminStatus tone={category.isActive ? 'ok' : 'out'}>
                {category.isActive ? 'Activa' : 'Inactiva'}
              </AdminStatus>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[#6d646a]">
              <span className="font-mono text-[9px] text-[#6d646a]">/{category.slug}</span>
              <span>·</span>
              <span>Orden: {category.position}</span>
              <span>·</span>
              <span>
                {category.children.length}{' '}
                {category.children.length === 1 ? 'subcategoría' : 'subcategorías'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddSubcategory(category.id)}
            className="text-[#764b77] hover:border-[#764b77]"
          >
            <Plus size={12} className="mr-1" /> Agregar subcategoría
          </Button>

          <Button variant="outline" size="sm" onClick={() => onEdit(category)}>
            <Edit2 size={12} className="mr-1" /> Editar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleActive.mutate(category)}
            disabled={toggleActive.isPending}
          >
            {category.isActive ? 'Desactivar' : 'Activar'}
          </Button>

          {!canDelete ? null : category.children.length === 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(category)}
              disabled={deleteCategory.isPending}
              className="text-danger hover:border-danger hover:bg-danger-bg cursor-pointer"
              aria-label={`Eliminar categoría ${category.name}`}
            >
              <Trash2 size={13} className="mr-1" /> Eliminar
            </Button>
          ) : (
            <span
              title="No se puede eliminar porque contiene subcategorías asociadas"
              className="inline-flex cursor-not-allowed items-center rounded border border-[#eee8ed] p-1.5 text-[#c2b6be]"
            >
              <Trash2 size={13} />
            </span>
          )}
        </div>
      </div>

      {/* Nivel 2: Subcategorías o estado vacío de hijos */}
      {category.children.length > 0 ? (
        <div className="p-3.5 space-y-2 bg-[#fcfbfa]">
          {category.children.map((sub) => (
            <div
              key={sub.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#eee8ed] bg-white px-3.5 py-2.5 transition-colors hover:border-[#e2d5df]"
            >
              <div className="flex items-center gap-2.5">
                <CornerDownRight size={14} className="text-[#6d6469] shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#493a45]">{sub.name}</span>
                    <AdminStatus tone={sub.isActive ? 'ok' : 'out'}>
                      {sub.isActive ? 'Activa' : 'Inactiva'}
                    </AdminStatus>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[9px] text-[#6d646a]">
                    <span className="font-mono text-[#6d646a]">/{sub.slug}</span>
                    <span>·</span>
                    <span>Orden: {sub.position}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(sub)}>
                  <Edit2 size={11} className="mr-1" /> Editar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive.mutate(sub)}
                  disabled={toggleActive.isPending}
                >
                  {sub.isActive ? 'Desactivar' : 'Activar'}
                </Button>

                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(sub)}
                    disabled={deleteCategory.isPending}
                    className="text-danger hover:border-danger hover:bg-danger-bg cursor-pointer"
                    aria-label={`Eliminar subcategoría ${sub.name}`}
                  >
                    <Trash2 size={12} className="mr-1" /> Eliminar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 bg-[#faf7f9] text-[10px] text-[#6d646a] flex items-center justify-between">
          <span>Esta categoría no tiene subcategorías (puede recibir productos directamente).</span>
          <Button
            variant="link"
            onClick={() => onAddSubcategory(category.id)}
            className="min-h-0 p-0 text-[10px] font-medium"
          >
            + Agregar primera subcategoría
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar categoría"
        description={
          deleteTarget
            ? `Esta acción eliminará "${deleteTarget.name}". Solo se permite cuando no tiene relaciones que lo impidan.`
            : ''
        }
        confirmLabel={deleteCategory.isPending ? 'Eliminando...' : 'Eliminar'}
        destructive
        onConfirm={() => {
          if (deleteTarget) deleteCategory.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
