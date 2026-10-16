'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, MessageSquareQuote, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import {
  testimonialPayload,
  testimonialSchema,
  type TestimonialFormValues,
} from '@/schemas/testimonials';
import type { PaginatedProducts } from '@/types/catalog';
import type { Testimonial } from '@/types/testimonials';

const TESTIMONIALS_KEY = ['admin-testimonials'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/** Valoración con estrellas llenas y vacías. */
function Stars({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={13}
          aria-hidden="true"
          className={value <= rating ? 'fill-[#a46ea4] text-[#a46ea4]' : 'text-[#d9cdd6]'}
        />
      ))}
    </span>
  );
}

/**
 * Testimonios de clientas que registra la propietaria a partir de opiniones reales. La tienda
 * publica el nombre y la inicial del apellido. `canEdit`: solo la propietaria los gestiona.
 */
export function TestimonialsManager({ canEdit }: { canEdit: boolean }) {
  const [editing, setEditing] = useState<Testimonial | 'new' | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: TESTIMONIALS_KEY,
    queryFn: () => apiFetch<Testimonial[]>('/admin/testimonials'),
  });

  return (
    <div className="space-y-5">
      <AdminPanel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AdminPanelTitle className="mb-0">Testimonios registrados</AdminPanelTitle>
            {data && (
              <Badge>
                {data.length} {data.length === 1 ? 'testimonio' : 'testimonios'}
              </Badge>
            )}
          </div>
          {canEdit && (
            <Button onClick={() => setEditing('new')} className="max-[600px]:w-full">
              <Plus size={15} className="mr-1.5" /> Agregar testimonio
            </Button>
          )}
        </div>
        <p className="mb-5 max-w-160 text-[11px] leading-relaxed text-muted">
          Registra opiniones reales que recibiste de tus clientas (por WhatsApp o redes). La tienda
          muestra hasta 6 publicados, del más reciente al más antiguo, con el nombre y la inicial
          del apellido.
        </p>

        {isPending && <p className="text-[11px] text-muted">Cargando testimonios…</p>}
        {isError && (
          <p className="text-[11px] text-danger">No se pudieron cargar los testimonios.</p>
        )}

        {data && data.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2.5 border border-[#eee8ed] bg-[#fbf9fa] px-5 py-12 text-center text-[11px] text-[#948692]">
            <MessageSquareQuote size={32} className="text-[#c4b7c1]" />
            <p className="font-medium text-[#493a45]">Aún no hay testimonios</p>
            <p className="text-[10px]">
              Mientras no haya testimonios publicados, la tienda no muestra esta sección.
            </p>
          </div>
        )}

        {data && data.length > 0 && (
          <div className="grid grid-cols-2 gap-3.5 max-[768px]:grid-cols-1">
            {data.map((testimonial) => (
              <TestimonialCard
                key={testimonial.id}
                testimonial={testimonial}
                canEdit={canEdit}
                onEdit={() => setEditing(testimonial)}
              />
            ))}
          </div>
        )}
      </AdminPanel>

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nuevo testimonio' : 'Editar testimonio'}
        description="Solo opiniones reales de clientas. Se publica el nombre y la inicial del apellido."
      >
        {editing !== null && (
          <TestimonialForm
            testimonial={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function TestimonialForm({
  testimonial,
  onDone,
}: {
  testimonial: Testimonial | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const products = useQuery({
    queryKey: ['admin-products-options'],
    queryFn: () => apiFetch<PaginatedProducts>('/admin/products?limit=100'),
  });
  const productOptions = (products.data?.items ?? []).filter(
    (product) => product.status !== 'ARCHIVED' || product.id === testimonial?.productId,
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TestimonialFormValues>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: {
      firstName: testimonial?.firstName ?? '',
      lastInitial: testimonial?.lastInitial ?? '',
      rating: testimonial ? String(testimonial.rating) : '',
      comment: testimonial?.comment ?? '',
      productId: testimonial?.productId ?? '',
      isPublished: testimonial?.isPublished ?? false,
    },
  });
  const commentLength = useWatch({ control, name: 'comment' }).length;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<Testimonial>(
        testimonial ? `/admin/testimonials/${testimonial.id}` : '/admin/testimonials',
        {
          method: testimonial ? 'PATCH' : 'POST',
          body: JSON.stringify(testimonialPayload(values)),
        },
      );
      toast.success(testimonial ? 'Testimonio actualizado.' : 'Testimonio agregado.');
      await queryClient.invalidateQueries({ queryKey: TESTIMONIALS_KEY });
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar el testimonio.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-[1fr_9rem] gap-3 max-[480px]:grid-cols-1">
        <FormField id="t-first-name" label="Nombre *" error={errors.firstName?.message}>
          <Input
            autoComplete="off"
            {...fieldA11y('t-first-name', errors.firstName?.message)}
            {...register('firstName')}
          />
        </FormField>
        <FormField
          id="t-last-initial"
          label="Inicial del apellido *"
          error={errors.lastInitial?.message}
        >
          <Input
            maxLength={2}
            autoComplete="off"
            {...fieldA11y('t-last-initial', errors.lastInitial?.message)}
            {...register('lastInitial')}
          />
        </FormField>
      </div>

      <FormField id="t-rating" label="Valoración *" error={errors.rating?.message}>
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <Select
              {...fieldA11y('t-rating', errors.rating?.message)}
              name={field.name}
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
            >
              <option value="">Elige la valoración</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={String(value)}>
                  {value} {value === 1 ? 'estrella' : 'estrellas'}
                </option>
              ))}
            </Select>
          )}
        />
      </FormField>

      <FormField
        id="t-comment"
        label="Comentario *"
        description={`${commentLength}/600 caracteres. Escríbelo como lo dijo la clienta.`}
        error={errors.comment?.message}
      >
        <Textarea
          rows={4}
          maxLength={600}
          {...fieldA11y('t-comment', errors.comment?.message)}
          {...register('comment')}
        />
      </FormField>

      <FormField
        id="t-product"
        label="Producto que compró (opcional)"
        description="Si el producto deja de estar publicado, la tienda no lo muestra."
      >
        <Controller
          control={control}
          name="productId"
          render={({ field }) => (
            <Select
              id="t-product"
              name={field.name}
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
              disabled={products.isPending}
            >
              <option value="">Sin producto</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
          )}
        />
      </FormField>

      <label className="flex min-h-11 items-center justify-between gap-4 border border-field-border bg-white px-3.5 py-2.5 text-[11px]">
        <span className="text-[#6f6269]">Publicar en la tienda</span>
        <Controller
          control={control}
          name="isPublished"
          render={({ field: { value, onChange } }) => (
            <Switch checked={value} onCheckedChange={onChange} />
          )}
        />
      </label>

      <div className="flex justify-end gap-2.5 border-t border-[#f0ecf0] pt-3">
        <Button variant="outline" type="button" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : testimonial ? 'Guardar cambios' : 'Agregar testimonio'}
        </Button>
      </div>
    </form>
  );
}

function TestimonialCard({
  testimonial,
  canEdit,
  onEdit,
}: {
  testimonial: Testimonial;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const author = `${testimonial.firstName} ${testimonial.lastInitial}.`;

  const togglePublished = useMutation({
    mutationFn: () =>
      apiFetch<Testimonial>(`/admin/testimonials/${testimonial.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !testimonial.isPublished }),
      }),
    onSuccess: async () => {
      toast.success(testimonial.isPublished ? 'Testimonio oculto.' : 'Testimonio publicado.');
      await queryClient.invalidateQueries({ queryKey: TESTIMONIALS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo actualizar el testimonio.')),
  });

  const remove = useMutation({
    mutationFn: () => apiFetch<void>(`/admin/testimonials/${testimonial.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Testimonio eliminado.');
      await queryClient.invalidateQueries({ queryKey: TESTIMONIALS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar el testimonio.')),
  });

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-[#493a45]">{author}</span>
            <div className="mt-1">
              <Stars rating={testimonial.rating} />
            </div>
          </div>
          <AdminStatus tone={testimonial.isPublished ? 'ok' : 'neutral'}>
            {testimonial.isPublished ? 'Publicado' : 'Sin publicar'}
          </AdminStatus>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mt-3 whitespace-pre-line text-[11px] leading-relaxed text-[#5b4c56]">
          “{testimonial.comment}”
        </p>
        {testimonial.productName && (
          <p className="mt-2 text-[10px] text-[#6f636b]">Producto: {testimonial.productName}</p>
        )}
      </CardContent>
      {canEdit && (
        <CardFooter className="mt-auto justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit2 size={12} className="mr-1" /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => togglePublished.mutate()}
            disabled={togglePublished.isPending}
          >
            {testimonial.isPublished ? 'Ocultar' : 'Publicar'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={remove.isPending}
            className="text-danger hover:border-danger hover:bg-danger-bg"
            aria-label={`Eliminar testimonio de ${author}`}
          >
            <Trash2 size={13} className="mr-1" /> Eliminar
          </Button>
        </CardFooter>
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar testimonio"
        description={`Se eliminará el testimonio de ${author}. Esta acción no se puede deshacer.`}
        confirmLabel={remove.isPending ? 'Eliminando...' : 'Eliminar testimonio'}
        destructive
        onConfirm={() => remove.mutate()}
      />
    </Card>
  );
}
