'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, PackagePlus, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import type { Carrier } from '@/types/shipping';

const CARRIERS_KEY = ['admin-carriers'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;

const blankForm = {
  name: '',
  trackingUrlTemplate: '',
  phone: '',
  isActive: true,
};

type CarrierFormState = typeof blankForm;

export function ShippingManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [form, setForm] = useState<CarrierFormState>(blankForm);
  const [formError, setFormError] = useState('');

  const carriersQuery = useQuery({
    queryKey: CARRIERS_KEY,
    queryFn: () => apiFetch<Carrier[]>('/admin/carriers'),
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        trackingUrlTemplate: form.trackingUrlTemplate.trim() || null,
        phone: form.phone.trim() || null,
        isActive: form.isActive,
      };
      return apiFetch<Carrier>(editing ? `/admin/carriers/${editing.id}` : '/admin/carriers', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      toast.success(editing ? 'Transportadora actualizada.' : 'Transportadora creada.');
      closeForm();
      await queryClient.invalidateQueries({ queryKey: CARRIERS_KEY });
    },
    onError: (error) => setFormError(errorMessage(error, 'No se pudo guardar la transportadora.')),
  });

  const carriers = (carriersQuery.data ?? []).filter((carrier) =>
    `${carrier.name} ${carrier.phone ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function openCreate() {
    setEditing(null);
    setForm(blankForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(carrier: Carrier) {
    setEditing(carrier);
    setForm({
      name: carrier.name,
      trackingUrlTemplate: carrier.trackingUrlTemplate ?? '',
      phone: carrier.phone ?? '',
      isActive: carrier.isActive,
    });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(blankForm);
    setFormError('');
  }

  return (
    <>
      <AdminPanel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AdminPanelTitle className="mb-0">Transportadoras</AdminPanelTitle>
            <Badge>{carriersQuery.data?.length ?? 0} registradas</Badge>
          </div>
          <Button onClick={openCreate}>
            <Plus size={15} />
            Crear transportadora
          </Button>
        </div>

        <div className="mb-5 grid gap-2.5 md:grid-cols-[minmax(220px,1fr)_auto]">
          <InputGroup>
            <InputGroupAddon>
              <Search size={15} />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar transportadora..."
              aria-label="Buscar transportadora"
              className="min-w-0"
            />
          </InputGroup>
          <div className="flex min-h-11.25 items-center text-[11px] text-[#8b7f87]">
            La URL de rastreo usa el marcador {'{tracking}'}.
          </div>
        </div>

        {carriersQuery.isPending && (
          <p className="text-[11px] text-muted">Cargando transportadoras...</p>
        )}
        {carriersQuery.isError && (
          <p className="text-[11px] text-danger">No se pudieron cargar las transportadoras.</p>
        )}

        {carriers.length > 0 ? (
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Transportadora</TableHead>
                <TableHead>Seguimiento</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carriers.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell>
                    <strong className="block text-[11px] text-[#493a45]">{carrier.name}</strong>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate">
                    {carrier.trackingUrlTemplate ?? 'Sin plantilla'}
                  </TableCell>
                  <TableCell>{carrier.phone ?? 'Sin teléfono'}</TableCell>
                  <TableCell>
                    <AdminStatus tone={carrier.isActive ? 'ok' : 'out'}>
                      {carrier.isActive ? 'Activa' : 'Inactiva'}
                    </AdminStatus>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(carrier)}>
                      <Edit2 size={14} />
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          !carriersQuery.isPending && (
            <div className="border border-dashed border-[#e5dce3] p-6 text-center">
              <PackagePlus className="mx-auto mb-2 h-5 w-5 text-[#9b7c99]" />
              <p className="text-[11px] text-[#8b7f87]">No hay transportadoras para mostrar.</p>
            </div>
          )
        )}
      </AdminPanel>

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editing ? 'Editar transportadora' : 'Crear transportadora'}
        description="La tienda guarda la guía y arma el enlace de rastreo; no consulta a la transportadora."
        maxWidth="md"
      >
        <div className="space-y-3">
          {formError && <FormError>{formError}</FormError>}
          <FormField id="carrier-name" label="Nombre">
            <Input
              id="carrier-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </FormField>
          <FormField
            id="carrier-template"
            label="Enlace de rastreo (opcional)"
            description="Usa {tracking} donde va el número de guía."
          >
            <Input
              id="carrier-template"
              value={form.trackingUrlTemplate}
              onChange={(event) =>
                setForm((current) => ({ ...current, trackingUrlTemplate: event.target.value }))
              }
              placeholder="https://…/{tracking}"
            />
          </FormField>
          <FormField id="carrier-phone" label="Teléfono (opcional)">
            <Input
              id="carrier-phone"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </FormField>
          <label className="flex min-h-11.25 items-center justify-between border border-[#eee8ed] px-3.5 text-[11px] text-[#493a45]">
            Transportadora activa
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, isActive: checked }))
              }
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button
              disabled={save.isPending || form.name.trim().length < 2}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
