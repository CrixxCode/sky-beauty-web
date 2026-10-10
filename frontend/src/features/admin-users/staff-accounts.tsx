'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import {
  createStaffSchema,
  resetPasswordSchema,
  type CreateStaffValues,
  type ResetPasswordValues,
} from '@/schemas/admin-auth';
import { ROLE_LABELS, type AdminUser } from '@/types/admin';

const USERS_KEY = ['admin-users'];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

const formatDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Bogota',
      }).format(new Date(iso))
    : 'Nunca';

const th = 'bg-[#f8f5f7] p-3.5 text-left text-[10px] font-semibold text-[#766a73]';
const td = 'border-b border-[#f0ecf0] px-3.5 py-3.25 text-[10px] text-[#625760]';

export function StaffAccounts() {
  const [search, setSearch] = useState('');
  const {
    data: users,
    isPending,
    isError,
  } = useQuery({
    queryKey: USERS_KEY,
    queryFn: () => apiFetch<AdminUser[]>('/admin/users'),
  });
  const visible = users?.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <CreateStaffForm />
      <AdminPanel>
        <div className="mb-3.5 flex items-center justify-between gap-5 max-[600px]:flex-col max-[600px]:items-start">
          <AdminPanelTitle className="mb-0">Cuentas del panel</AdminPanelTitle>
          <label className="flex items-center gap-2.5 border border-[#e8dfe6] p-2.5 text-[#917987] max-[600px]:w-full">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cuentas"
              aria-label="Buscar cuentas"
              className="border-0 text-[11px] outline-0 max-[600px]:w-full"
            />
          </label>
        </div>
        {isPending && <p className="text-[11px] text-muted">Cargando…</p>}
        {isError && <p className="text-[11px] text-danger">No se pudieron cargar las cuentas.</p>}
        {visible && visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 bg-[#fbf9fa] px-5 py-12.5 text-center text-[11px] text-[#948692]">
            <Users size={32} /> No hay cuentas que coincidan con la búsqueda.
          </div>
        )}
        {visible && visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-157.5 border-collapse">
              <thead>
                <tr>
                  <th className={th}>Cuenta</th>
                  <th className={th}>Rol</th>
                  <th className={th}>Último ingreso</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <AccountRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}

function CreateStaffForm() {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffValues>({ resolver: zodResolver(createStaffSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(values) });
      reset();
      toast.success('Cuenta del personal creada.');
      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear la cuenta.'));
    }
  });

  return (
    <AdminPanel>
      <AdminPanelTitle>Nueva cuenta del personal</AdminPanelTitle>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-x-4.5 min-[601px]:grid-cols-2">
          <FormField id="staff-name" label="Nombre" error={errors.name?.message}>
            <Input {...fieldA11y('staff-name', errors.name?.message)} {...register('name')} />
          </FormField>
          <FormField id="staff-email" label="Correo" error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="off"
              {...fieldA11y('staff-email', errors.email?.message)}
              {...register('email')}
            />
          </FormField>
          <FormField
            id="staff-password"
            label="Contraseña inicial"
            error={errors.password?.message}
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...fieldA11y('staff-password', errors.password?.message)}
              {...register('password')}
            />
          </FormField>
        </div>
        <Button type="submit" className="mt-2" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </form>
    </AdminPanel>
  );
}

function AccountRow({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const isStaff = user.role === 'STAFF';
  const locked = user.lockedUntil !== null && new Date(user.lockedUntil) > new Date();

  const toggleActive = useMutation({
    mutationFn: () =>
      apiFetch<AdminUser>(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      }),
    onSuccess: async () => {
      toast.success(user.isActive ? 'Cuenta desactivada.' : 'Cuenta activada.');
      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo actualizar la cuenta.')),
  });

  return (
    <Fragment>
      <tr>
        <td className={td}>
          <span className="block min-w-37.5 text-[10px] font-medium">
            {user.name}
            <small className="mt-1 block text-[9px] text-[#a4979e]">{user.email}</small>
          </span>
        </td>
        <td className={td}>{ROLE_LABELS[user.role]}</td>
        <td className={td}>{formatDate(user.lastLoginAt)}</td>
        <td className={td}>
          {!user.isActive ? (
            <AdminStatus tone="out">Desactivada</AdminStatus>
          ) : locked ? (
            <AdminStatus tone="out">Bloqueada temporalmente</AdminStatus>
          ) : (
            <AdminStatus>Activa</AdminStatus>
          )}
        </td>
        <td className={td}>
          {isStaff && (
            <div className="flex gap-2 whitespace-nowrap">
              <Button variant="outline" size="sm" onClick={() => setResetting((v) => !v)}>
                Restablecer contraseña
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleActive.mutate()}
                disabled={toggleActive.isPending}
              >
                {user.isActive ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          )}
        </td>
      </tr>
      {resetting && (
        <tr>
          <td colSpan={5} className={td}>
            <ResetPasswordForm user={user} onDone={() => setResetting(false)} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function ResetPasswordForm({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const queryClient = useQueryClient();
  const id = `reset-${user.id}`;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch<void>(`/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      toast.success(`Contraseña de ${user.name} restablecida. Se cerraron sus sesiones.`);
      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo restablecer la contraseña.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-3">
      <FormField
        id={id}
        label={`Contraseña nueva para ${user.name}`}
        error={errors.newPassword?.message}
        className="mb-0 min-w-60 flex-1"
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...fieldA11y(id, errors.newPassword?.message)}
          {...register('newPassword')}
        />
      </FormField>
      <Button type="submit" size="sm" disabled={isSubmitting}>
        Guardar
      </Button>
    </form>
  );
}
