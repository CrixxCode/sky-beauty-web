'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { AdminPanel, AdminPanelTitle } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import {
  commercialSettingsSchema,
  contactSettingsSchema,
  toNullableNumber,
  type CommercialSettingsValues,
  type ContactSettingsValues,
} from '@/schemas/store-settings';
import type { StoreSettings } from '@/types/store';

export const SETTINGS_KEY = ['store-settings'];

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'No se pudo guardar la configuración.';

/** Datos de contacto y redes, y cifras comerciales. El personal los ve sin poder editarlos. */
export function StoreSettingsForms({ canEdit }: { canEdit: boolean }) {
  const { data, isPending, isError } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiFetch<StoreSettings>('/admin/settings'),
  });

  if (isPending) return <p className="text-[11px] text-muted">Cargando configuración…</p>;
  if (isError)
    return <p className="text-[11px] text-danger">No se pudo cargar la configuración.</p>;

  return (
    <>
      <ContactForm settings={data} canEdit={canEdit} />
      <CommercialForm settings={data} canEdit={canEdit} />
    </>
  );
}

function useSaveSettings() {
  const queryClient = useQueryClient();
  return async (body: Record<string, unknown>) => {
    try {
      const saved = await apiFetch<StoreSettings>('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      queryClient.setQueryData(SETTINGS_KEY, saved);
      toast.success('Configuración guardada.');
      return saved;
    } catch (error) {
      toast.error(errorMessage(error));
      return null;
    }
  };
}

function ContactForm({ settings, canEdit }: { settings: StoreSettings; canEdit: boolean }) {
  const save = useSaveSettings();
  const toValues = (s: StoreSettings): ContactSettingsValues => ({
    whatsappNumber: s.whatsappNumber ?? '',
    contactEmail: s.contactEmail ?? '',
    contactPhone: s.contactPhone ?? '',
    addressText: s.addressText ?? '',
    businessHours: s.businessHours ?? '',
    instagramUrl: s.instagramUrl ?? '',
    facebookUrl: s.facebookUrl ?? '',
    tiktokUrl: s.tiktokUrl ?? '',
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactSettingsValues>({
    resolver: zodResolver(contactSettingsSchema),
    defaultValues: toValues(settings),
  });

  const onSubmit = handleSubmit(async (values) => {
    const saved = await save(values);
    if (saved) reset(toValues(saved));
  });

  const field = (
    name: keyof ContactSettingsValues,
    label: string,
    props: React.ComponentProps<'input'> = {},
    wide = false,
  ) => (
    <FormField
      id={name}
      label={label}
      error={errors[name]?.message}
      className={wide ? 'min-[601px]:col-span-2' : undefined}
    >
      <Input {...props} {...fieldA11y(name, errors[name]?.message)} {...register(name)} />
    </FormField>
  );

  return (
    <AdminPanel>
      <AdminPanelTitle>Contacto y redes sociales</AdminPanelTitle>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={!canEdit} className="grid gap-x-4.5 min-[601px]:grid-cols-2">
          {field('whatsappNumber', 'WhatsApp comercial', {
            inputMode: 'tel',
            placeholder: '300 123 4567',
          })}
          {field('contactEmail', 'Correo de contacto', { type: 'email' })}
          {field('contactPhone', 'Teléfono de contacto', { inputMode: 'tel' })}
          {field('businessHours', 'Horario de atención')}
          {field('addressText', 'Dirección', {}, true)}
          {field('instagramUrl', 'Instagram', { placeholder: 'https://instagram.com/…' })}
          {field('facebookUrl', 'Facebook', { placeholder: 'https://facebook.com/…' })}
          {field('tiktokUrl', 'TikTok', { placeholder: 'https://tiktok.com/@…' })}
        </fieldset>
        <p className="mt-1 text-[10px] leading-relaxed text-[#a0929a]">
          El número de WhatsApp se guarda con el código de país (57). Los campos vacíos no se
          muestran en la tienda.
        </p>
        {canEdit && (
          <Button type="submit" className="mt-4" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Guardar contacto'}
          </Button>
        )}
      </form>
    </AdminPanel>
  );
}

function CommercialForm({ settings, canEdit }: { settings: StoreSettings; canEdit: boolean }) {
  const save = useSaveSettings();
  const toValues = (s: StoreSettings): CommercialSettingsValues => ({
    freeShippingThreshold: s.freeShippingThreshold?.toString() ?? '',
    defaultLowStockThreshold: s.defaultLowStockThreshold?.toString() ?? '',
    maxPercentageDiscount: s.maxPercentageDiscount?.toString() ?? '',
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommercialSettingsValues>({
    resolver: zodResolver(commercialSettingsSchema),
    defaultValues: toValues(settings),
  });

  const onSubmit = handleSubmit(async (values) => {
    const saved = await save({
      freeShippingThreshold: toNullableNumber(values.freeShippingThreshold),
      defaultLowStockThreshold: toNullableNumber(values.defaultLowStockThreshold),
      maxPercentageDiscount: toNullableNumber(values.maxPercentageDiscount),
    });
    if (saved) reset(toValues(saved));
  });

  const field = (name: keyof CommercialSettingsValues, label: string, hint: string) => (
    <FormField id={name} label={label} error={errors[name]?.message}>
      <Input inputMode="decimal" {...fieldA11y(name, errors[name]?.message)} {...register(name)} />
      <small className="text-[10px] font-normal text-[#a0929a]">{hint}</small>
    </FormField>
  );

  return (
    <AdminPanel>
      <AdminPanelTitle>Cifras comerciales</AdminPanelTitle>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={!canEdit} className="grid gap-x-4.5 min-[601px]:grid-cols-3">
          {field(
            'freeShippingThreshold',
            'Envío gratis desde (COP)',
            'Subtotal después de descuentos. Vacío: sin envío gratis.',
          )}
          {field(
            'defaultLowStockThreshold',
            'Stock bajo por defecto (unidades)',
            'Se propone al crear una variante. Vacío: no se propone.',
          )}
          {field(
            'maxPercentageDiscount',
            'Descuento máximo (%)',
            'Límite para promociones porcentuales. Vacío: hasta 100 %.',
          )}
        </fieldset>
        {canEdit && (
          <Button type="submit" className="mt-4" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Guardar cifras'}
          </Button>
        )}
      </form>
    </AdminPanel>
  );
}
