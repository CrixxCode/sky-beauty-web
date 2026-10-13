'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminPanel, AdminPanelTitle } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { formatCOP } from '@/lib/format';
import {
  commercialSettingsSchema,
  contactSettingsSchema,
  toNullableNumber,
  type CommercialSettingsValues,
  type ContactSettingsValues,
} from '@/schemas/store-settings';
import type { Location, ShippingRate, StoreSettings } from '@/types/store';

export const SETTINGS_KEY = ['store-settings'];
const SHIPPING_RATES_KEY = ['shipping-rates'];

const errorMessage = (error: unknown, fallback = 'No se pudo guardar la configuracion.') =>
  error instanceof ApiError ? error.message : fallback;

export function StoreSettingsForms({ canEdit }: { canEdit: boolean }) {
  const { data, isPending, isError } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiFetch<StoreSettings>('/admin/settings'),
  });

  if (isPending) return <p className="text-[11px] text-muted">Cargando configuracion...</p>;
  if (isError)
    return <p className="text-[11px] text-danger">No se pudo cargar la configuracion.</p>;

  return (
    <>
      <ContactForm settings={data} canEdit={canEdit} />
      <CommercialForm settings={data} canEdit={canEdit} />
      <ShippingRatesPanel canEdit={canEdit} />
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
      toast.success('Configuracion guardada.');
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
          {field('contactPhone', 'Telefono de contacto', { inputMode: 'tel' })}
          {field('businessHours', 'Horario de atencion')}
          {field('addressText', 'Direccion', {}, true)}
          {field('instagramUrl', 'Instagram', { placeholder: 'https://instagram.com/...' })}
          {field('facebookUrl', 'Facebook', { placeholder: 'https://facebook.com/...' })}
          {field('tiktokUrl', 'TikTok', { placeholder: 'https://tiktok.com/@...' })}
        </fieldset>
        <p className="mt-1 text-[10px] leading-relaxed text-[#a0929a]">
          El numero de WhatsApp se guarda con el codigo de pais (57). Los campos vacios no se
          muestran en la tienda.
        </p>
        {canEdit && (
          <Button type="submit" className="mt-4" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar contacto'}
          </Button>
        )}
      </form>
    </AdminPanel>
  );
}

function CommercialForm({ settings, canEdit }: { settings: StoreSettings; canEdit: boolean }) {
  const save = useSaveSettings();
  const toValues = (s: StoreSettings): CommercialSettingsValues => ({
    nationalFreeShipping: s.nationalFreeShipping,
    freeShippingThreshold: s.freeShippingThreshold?.toString() ?? '',
    defaultLowStockThreshold: s.defaultLowStockThreshold?.toString() ?? '',
    maxPercentageDiscount: s.maxPercentageDiscount?.toString() ?? '',
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommercialSettingsValues>({
    resolver: zodResolver(commercialSettingsSchema),
    defaultValues: toValues(settings),
  });

  const onSubmit = handleSubmit(async (values) => {
    const saved = await save({
      nationalFreeShipping: values.nationalFreeShipping,
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
          <FormField
            id="nationalFreeShipping"
            label="Envio gratis nacional"
            className="min-[601px]:col-span-3"
          >
            <label className="flex min-h-11 items-center justify-between gap-4 border border-input-border bg-white px-3.5 py-2.5 text-[11px]">
              <span className="text-[#6f6269]">
                Activalo para campanas temporales, por ejemplo un fin de semana.
              </span>
              <Controller
                control={control}
                name="nationalFreeShipping"
                render={({ field: { value, onChange } }) => (
                  <Switch checked={value} onCheckedChange={onChange} />
                )}
              />
            </label>
          </FormField>
          {field(
            'freeShippingThreshold',
            'Envio gratis desde (COP)',
            'Subtotal despues de descuentos. Vacio: sin envio gratis por monto.',
          )}
          {field(
            'defaultLowStockThreshold',
            'Stock bajo por defecto (unidades)',
            'Se propone al crear una variante. Vacio: no se propone.',
          )}
          {field(
            'maxPercentageDiscount',
            'Descuento maximo (%)',
            'Limite para promociones porcentuales. Vacio: hasta 100 %.',
          )}
        </fieldset>
        {canEdit && (
          <Button type="submit" className="mt-4" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar cifras'}
          </Button>
        )}
      </form>
    </AdminPanel>
  );
}

function ShippingRatesPanel({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [departmentCode, setDepartmentCode] = useState('');
  const [municipalityCode, setMunicipalityCode] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const rates = useQuery({
    queryKey: SHIPPING_RATES_KEY,
    queryFn: () => apiFetch<ShippingRate[]>('/admin/settings/shipping-rates'),
  });
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<Location[]>('/store/locations/departments'),
    staleTime: Infinity,
    enabled: canEdit,
  });
  const municipalities = useQuery({
    queryKey: ['municipalities', departmentCode],
    queryFn: () =>
      apiFetch<Location[]>(`/store/locations/departments/${departmentCode}/municipalities`),
    staleTime: Infinity,
    enabled: canEdit && departmentCode !== '',
  });

  async function saveRate() {
    if (!municipalityCode) {
      toast.error('Selecciona un municipio.');
      return;
    }
    if (!Number.isInteger(Number(amount)) || Number(amount) < 0) {
      toast.error('Ingresa una tarifa en pesos, sin decimales.');
      return;
    }
    setSaving(true);
    try {
      const saved = await apiFetch<ShippingRate>('/admin/settings/shipping-rates', {
        method: 'POST',
        body: JSON.stringify({ municipalityCode, amount: Number(amount) }),
      });
      queryClient.setQueryData<ShippingRate[]>(SHIPPING_RATES_KEY, (list) =>
        [...(list?.filter((rate) => rate.id !== saved.id) ?? []), saved].sort((a, b) =>
          `${a.departmentName} ${a.municipalityName}`.localeCompare(
            `${b.departmentName} ${b.municipalityName}`,
            'es',
          ),
        ),
      );
      setMunicipalityCode('');
      setAmount('');
      toast.success('Tarifa de envio guardada.');
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar la tarifa.'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRate(rate: ShippingRate) {
    setSaving(true);
    try {
      await apiFetch(`/admin/settings/shipping-rates/${rate.id}`, { method: 'DELETE' });
      queryClient.setQueryData<ShippingRate[]>(SHIPPING_RATES_KEY, (list) =>
        list?.filter((item) => item.id !== rate.id),
      );
      toast.success('Tarifa eliminada.');
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo eliminar la tarifa.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPanel>
      <AdminPanelTitle>Tarifas de envio por municipio</AdminPanelTitle>
      <p className="mb-4 text-[10px] leading-relaxed text-[#a0929a]">
        Si el municipio tiene tarifa, el checkout la usa automaticamente. Si no la tiene, el envio
        queda por confirmar, salvo que aplique envio gratis.
      </p>
      {canEdit && (
        <div className="grid gap-x-3 min-[701px]:grid-cols-[1fr_1fr_150px_auto]">
          <FormField id="shipping-rate-department" label="Departamento">
            <Select
              id="shipping-rate-department"
              value={departmentCode}
              onChange={(event) => {
                setDepartmentCode(event.target.value);
                setMunicipalityCode('');
              }}
            >
              <option value="">Selecciona...</option>
              {departments.data?.map((department) => (
                <option key={department.code} value={department.code}>
                  {department.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="shipping-rate-municipality" label="Municipio">
            <Select
              id="shipping-rate-municipality"
              value={municipalityCode}
              onChange={(event) => setMunicipalityCode(event.target.value)}
              disabled={!departmentCode}
            >
              <option value="">Selecciona...</option>
              {municipalities.data?.map((municipality) => (
                <option key={municipality.code} value={municipality.code}>
                  {municipality.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="shipping-rate-amount" label="Tarifa (COP)">
            <Input
              id="shipping-rate-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="5000"
            />
          </FormField>
          <div className="flex items-end pb-4">
            <Button type="button" onClick={() => void saveRate()} disabled={saving}>
              Guardar
            </Button>
          </div>
        </div>
      )}

      {rates.isPending && <p className="text-[11px] text-muted">Cargando tarifas...</p>}
      {rates.isError && <p className="text-[11px] text-danger">No se pudieron cargar.</p>}
      {rates.data?.length === 0 && (
        <p className="text-[11px] text-muted">No hay tarifas configuradas.</p>
      )}
      {rates.data && rates.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Municipio</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Tarifa</TableHead>
              {canEdit && <TableHead aria-label="Acciones" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.data.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell>{rate.municipalityName}</TableCell>
                <TableCell>{rate.departmentName}</TableCell>
                <TableCell>{formatCOP(rate.amount)}</TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Eliminar tarifa de ${rate.municipalityName}`}
                      onClick={() => void deleteRate(rate)}
                      disabled={saving}
                    >
                      <X size={15} />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AdminPanel>
  );
}
