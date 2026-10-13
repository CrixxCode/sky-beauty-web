'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Save, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AdminPanel, AdminPanelTitle } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import type { StoreContent, StorePageSlug } from '@/types/store';

const CONTENT_KEY = ['admin-content'];

type Field = keyof StoreContent;

const LEGAL_FIELDS: Array<{ field: Field; slug: StorePageSlug; label: string }> = [
  { field: 'termsText', slug: 'terminos', label: 'Términos y condiciones' },
  { field: 'privacyText', slug: 'datos-personales', label: 'Tratamiento de datos personales' },
  {
    field: 'returnsPolicyText',
    slug: 'cambios-y-garantias',
    label: 'Cambios, devoluciones y garantías',
  },
  { field: 'shippingPolicyText', slug: 'envios', label: 'Política de envíos' },
];

const toForm = (content: StoreContent): Record<Field, string> =>
  Object.fromEntries(Object.entries(content).map(([key, value]) => [key, value ?? ''])) as Record<
    Field,
    string
  >;

/** Contenido de la tienda (módulo 12). La propietaria lo edita; el personal lo ve sin editar. */
export function ContentForm({ canEdit }: { canEdit: boolean }) {
  const query = useQuery({
    queryKey: CONTENT_KEY,
    queryFn: () => apiFetch<StoreContent>('/admin/content'),
  });

  if (query.isPending) return <p className="text-[11px] text-muted">Cargando contenido…</p>;
  if (query.isError) {
    return <p className="text-[11px] text-danger">No se pudo cargar el contenido.</p>;
  }
  return <ContentEditor initial={query.data} canEdit={canEdit} />;
}

function ContentEditor({ initial, canEdit }: { initial: StoreContent; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<Field, string>>(() => toForm(initial));

  const save = useMutation({
    mutationFn: (fields: Field[]) =>
      apiFetch<StoreContent>('/admin/content', {
        method: 'PATCH',
        body: JSON.stringify(Object.fromEntries(fields.map((field) => [field, form[field]]))),
      }),
    onSuccess: (content) => {
      queryClient.setQueryData(CONTENT_KEY, content);
      setForm(toForm(content));
      toast.success('Contenido guardado.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar el contenido.'),
  });

  const bind = (field: Field) => ({
    id: `content-${field}`,
    value: form[field],
    readOnly: !canEdit,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value })),
  });
  const saveButton = (fields: Field[], label: string) =>
    canEdit && (
      <Button disabled={save.isPending} onClick={() => save.mutate(fields)}>
        <Save size={15} /> {save.isPending ? 'Guardando...' : label}
      </Button>
    );

  return (
    <div className="grid gap-5">
      {!canEdit && (
        <p className="text-[11px] text-[#8b7f87]">
          Solo la propietaria puede modificar el contenido.
        </p>
      )}

      <AdminPanel>
        <AdminPanelTitle>Inicio</AdminPanelTitle>
        <FormField
          id="content-heroTitle"
          label="Título principal"
          description="Sin título se muestra el nombre de la tienda."
        >
          <Input {...bind('heroTitle')} maxLength={120} />
        </FormField>
        <FormField id="content-heroSubtitle" label="Texto bajo el título (opcional)">
          <Textarea {...bind('heroSubtitle')} rows={2} maxLength={300} />
        </FormField>
        <FormField
          id="content-announcementText"
          label="Barra de anuncio (opcional)"
          description="Aparece arriba en toda la tienda. Vacía, no se muestra."
        >
          <Input {...bind('announcementText')} maxLength={160} />
        </FormField>
        <FormField
          id="content-tagline"
          label="Descripción de la tienda (opcional)"
          description="La usan los buscadores y la vista previa al compartir la tienda en redes."
        >
          <Textarea {...bind('tagline')} rows={2} maxLength={160} />
        </FormField>
        {saveButton(['heroTitle', 'heroSubtitle', 'announcementText', 'tagline'], 'Guardar inicio')}
      </AdminPanel>

      <AdminPanel>
        <AdminPanelTitle>Páginas legales</AdminPanelTitle>
        <p className="mb-4 flex gap-2 border border-[#ecd9b5] bg-[#fff9ee] p-3 text-[11px] leading-relaxed text-[#7a5413]">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          Publica solo textos aprobados por la propietaria y revisados legalmente. Una página vacía
          no aparece en la tienda.
        </p>
        <p className="mb-4 text-[10px] leading-relaxed text-[#8b7f87]">
          Formato: <code># Título</code>, <code>## Subtítulo</code>, <code>- elemento</code> para
          listas, <code>**negrita**</code> y una línea en blanco entre párrafos.
        </p>
        {LEGAL_FIELDS.map(({ field, slug, label }) => (
          <FormField
            key={field}
            id={`content-${field}`}
            label={label}
            description={
              initial[field] ? (
                <Link
                  href={`/${slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 underline"
                >
                  Ver página publicada <ExternalLink size={11} />
                </Link>
              ) : (
                'Sin publicar.'
              )
            }
          >
            <Textarea {...bind(field)} rows={10} maxLength={50_000} />
          </FormField>
        ))}
        {saveButton(
          LEGAL_FIELDS.map((item) => item.field),
          'Guardar páginas legales',
        )}
      </AdminPanel>
    </div>
  );
}
