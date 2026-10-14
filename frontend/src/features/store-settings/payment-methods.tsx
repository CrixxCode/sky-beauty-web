'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import { formatCOP } from '@/lib/format';
import type { Location, PaymentMethod, PaymentMethodCity } from '@/types/store';

const METHODS_KEY = ['payment-methods'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/** Métodos de pago (tarjetas como .admin-taxonomy del prototipo). El personal solo los consulta. */
export function PaymentMethodsPanel({ canEdit }: { canEdit: boolean }) {
  const { data, isPending, isError } = useQuery({
    queryKey: METHODS_KEY,
    queryFn: () => apiFetch<PaymentMethod[]>('/admin/payment-methods'),
  });

  return (
    <AdminPanel>
      <AdminPanelTitle>Métodos de pago</AdminPanelTitle>
      {isPending && <p className="text-[11px] text-muted">Cargando…</p>}
      {isError && <p className="text-[11px] text-danger">No se pudieron cargar los métodos.</p>}
      <div className="grid gap-3 min-[601px]:grid-cols-2">
        {data?.map((method) => (
          <PaymentMethodCard key={method.id} method={method} canEdit={canEdit} />
        ))}
      </div>
    </AdminPanel>
  );
}

function PaymentMethodCard({ method, canEdit }: { method: PaymentMethod; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [instructions, setInstructions] = useState(method.instructions ?? '');
  const [maxOrderTotal, setMaxOrderTotal] = useState(method.maxOrderTotal?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const idPrefix = `method-${method.code.toLowerCase()}`;

  async function patch(body: Record<string, unknown>, success: string) {
    setSaving(true);
    try {
      const saved = await apiFetch<PaymentMethod>(`/admin/payment-methods/${method.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      queryClient.setQueryData<PaymentMethod[]>(METHODS_KEY, (list) =>
        list?.map((m) => (m.id === saved.id ? saved : m)),
      );
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar el método de pago.'));
    } finally {
      setSaving(false);
    }
  }

  function saveDetails() {
    const total = maxOrderTotal.trim();
    if (total !== '' && (!Number.isInteger(Number(total)) || Number(total) < 0)) {
      toast.error('El total máximo debe ser un valor en pesos, sin decimales.');
      return;
    }
    void patch(
      {
        instructions,
        ...(method.restrictToCities ? { maxOrderTotal: total === '' ? null : Number(total) } : {}),
      },
      `${method.name}: cambios guardados.`,
    );
  }

  return (
    <section
      aria-label={method.name}
      className="flex flex-col gap-3 border border-admin-line bg-[#fbf9fa] p-4.75"
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="text-xs font-semibold">{method.name}</strong>
        <AdminStatus tone={method.isActive ? 'ok' : 'out'}>
          {method.isActive ? 'Activo' : 'Inactivo'}
        </AdminStatus>
      </div>
      <small className="text-[10px] text-[#a0929a]">
        {method.requiresVerification
          ? 'La tienda verifica el pago con el comprobante. Requiere instrucciones para activarse.'
          : 'Se paga al recibir el pedido. Solo en los municipios configurados.'}
      </small>

      <fieldset disabled={!canEdit || saving}>
        <FormField id={`${idPrefix}-instructions`} label="Instrucciones para el cliente">
          <Textarea
            id={`${idPrefix}-instructions`}
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={
              method.requiresVerification ? 'Número de cuenta, titular, tipo de cuenta…' : ''
            }
          />
        </FormField>
        {method.restrictToCities && (
          <FormField id={`${idPrefix}-max`} label="Total máximo del pedido (COP)">
            <Input
              id={`${idPrefix}-max`}
              inputMode="numeric"
              value={maxOrderTotal}
              onChange={(e) => setMaxOrderTotal(e.target.value)}
              placeholder="Vacío: sin máximo"
            />
            {method.maxOrderTotal !== null && (
              <small className="text-[10px] font-normal text-[#a0929a]">
                Actual: {formatCOP(method.maxOrderTotal)}
              </small>
            )}
          </FormField>
        )}
      </fieldset>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={saveDetails} disabled={saving}>
            Guardar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() =>
              void patch(
                { isActive: !method.isActive },
                `${method.name} ${method.isActive ? 'desactivado' : 'activado'}.`,
              )
            }
          >
            {method.isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      )}

      {method.restrictToCities && <CitiesManager method={method} canEdit={canEdit} />}
    </section>
  );
}

/** Municipios donde se ofrece el contra entrega (lista oficial del DANE). */
function CitiesManager({ method, canEdit }: { method: PaymentMethod; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [cities, setCities] = useState<PaymentMethodCity[]>(method.cities);
  const [departmentCode, setDepartmentCode] = useState('');
  const [municipalityCode, setMunicipalityCode] = useState('');
  const [saving, setSaving] = useState(false);
  const idPrefix = `cities-${method.code.toLowerCase()}`;

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

  const dirty =
    cities.map((c) => c.municipalityCode).join() !==
    method.cities.map((c) => c.municipalityCode).join();

  function addCity() {
    const municipality = municipalities.data?.find((m) => m.code === municipalityCode);
    const department = departments.data?.find((d) => d.code === departmentCode);
    if (!municipality || !department) return;
    if (cities.some((c) => c.municipalityCode === municipality.code)) return;
    setCities((list) =>
      [
        ...list,
        {
          municipalityCode: municipality.code,
          municipalityName: municipality.name,
          departmentName: department.name,
        },
      ].sort((a, b) => a.municipalityName.localeCompare(b.municipalityName, 'es')),
    );
    setMunicipalityCode('');
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await apiFetch<PaymentMethod>(`/admin/payment-methods/${method.id}/cities`, {
        method: 'PUT',
        body: JSON.stringify({ municipalityCodes: cities.map((c) => c.municipalityCode) }),
      });
      queryClient.setQueryData<PaymentMethod[]>(METHODS_KEY, (list) =>
        list?.map((m) => (m.id === saved.id ? saved : m)),
      );
      setCities(saved.cities);
      toast.success('Municipios guardados.');
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron guardar los municipios.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-admin-line pt-3">
      <p className="mb-2 text-[11px] font-medium text-field-label">
        Municipios habilitados ({cities.length})
      </p>
      {cities.length === 0 && (
        <p className="mb-2 text-[10px] text-[#a0929a]">
          Sin municipios: el contra entrega no se ofrece en ningún lugar.
        </p>
      )}
      <ul className="mb-3 flex flex-wrap gap-2">
        {cities.map((city) => (
          <li
            key={city.municipalityCode}
            className="inline-flex items-center gap-1.75 bg-[#f3e8f1] px-2.5 py-1.75 text-[10px] text-[#70416e]"
          >
            {city.municipalityName}, {city.departmentName}
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-auto w-auto min-h-0 p-0 text-[#70416e] not-disabled:hover:bg-transparent"
                aria-label={`Quitar ${city.municipalityName}`}
                onClick={() =>
                  setCities((list) =>
                    list.filter((c) => c.municipalityCode !== city.municipalityCode),
                  )
                }
              >
                <X size={12} />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <>
          <div className="grid gap-x-3 min-[601px]:grid-cols-2">
            <FormField id={`${idPrefix}-department`} label="Departamento">
              <Select
                id={`${idPrefix}-department`}
                value={departmentCode}
                onChange={(e) => {
                  setDepartmentCode(e.target.value);
                  setMunicipalityCode('');
                }}
              >
                <option value="">Selecciona…</option>
                {departments.data?.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id={`${idPrefix}-municipality`} label="Municipio">
              <Select
                id={`${idPrefix}-municipality`}
                value={municipalityCode}
                onChange={(e) => setMunicipalityCode(e.target.value)}
                disabled={!departmentCode}
              >
                <option value="">Selecciona…</option>
                {municipalities.data?.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={addCity} disabled={!municipalityCode}>
              Agregar municipio
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
              Guardar municipios
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
