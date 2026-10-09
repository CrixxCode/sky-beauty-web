'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
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

export function StaffAccounts() {
  const {
    data: users,
    isPending,
    isError,
  } = useQuery({
    queryKey: USERS_KEY,
    queryFn: () => apiFetch<AdminUser[]>('/admin/users'),
  });

  return (
    <div className="space-y-8">
      <CreateStaffForm />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cuentas</h2>
        {isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {isError && <p className="text-sm text-danger">No se pudieron cargar las cuentas.</p>}
        <ul className="space-y-3">
          {users?.map((user) => (
            <AccountRow key={user.id} user={user} />
          ))}
        </ul>
      </section>
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
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Nueva cuenta del personal</h2>
      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-3">
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
        <FormField id="staff-password" label="Contraseña inicial" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            {...fieldA11y('staff-password', errors.password?.message)}
            {...register('password')}
          />
        </FormField>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear cuenta'}
          </Button>
        </div>
      </form>
    </section>
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
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {user.name}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              · {ROLE_LABELS[user.role]}
            </span>
          </p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Último ingreso: {formatDate(user.lastLoginAt)}
            {!user.isActive && ' · Desactivada'}
            {locked && ' · Bloqueada temporalmente'}
          </p>
        </div>
        {isStaff && (
          <div className="flex flex-wrap gap-2">
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
      </div>
      {resetting && <ResetPasswordForm user={user} onDone={() => setResetting(false)} />}
    </li>
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
    <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-60 flex-1">
        <FormField id={id} label="Contraseña nueva" error={errors.newPassword?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            {...fieldA11y(id, errors.newPassword?.message)}
            {...register('newPassword')}
          />
        </FormField>
      </div>
      <Button type="submit" size="sm" disabled={isSubmitting}>
        Guardar
      </Button>
    </form>
  );
}
