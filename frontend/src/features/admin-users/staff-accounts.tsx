'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Search, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { AdminPanel, AdminPanelTitle, AdminStatus } from '@/features/admin-auth/admin-ui';
import { ApiError, apiFetch } from '@/lib/api';
import {
  createStaffSchema,
  resetPasswordSchema,
  type CreateStaffValues,
  type ResetPasswordValues,
} from '@/schemas/admin-auth';
import { ROLE_LABELS, type AdminUser } from '@/types/admin';

export const USERS_KEY = ['admin-users'];

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

const th = 'bg-[#f8f5f7] p-3 text-left text-[10px] font-semibold text-[#766a73]';
const td = 'border-b border-[#f0ecf0] px-3 py-3 text-[10px] text-[#625760] align-middle';

export function StaffAccounts() {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);

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
      <AdminPanel>
        {/* Barra superior con título y controles */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AdminPanelTitle className="mb-0">Cuentas del panel</AdminPanelTitle>
            {users && (
              <span className="rounded-full bg-[#f4eff3] px-2.5 py-0.5 text-[10px] font-semibold text-[#764b77]">
                {users.length} {users.length === 1 ? 'cuenta' : 'cuentas'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 max-[600px]:w-full">
            <div className="relative flex items-center border border-[#e8dfe6] bg-white text-[#917987] transition-colors focus-within:border-[#936591] max-[600px]:w-full">
              <span className="pl-3 text-[#917987]">
                <Search size={15} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                aria-label="Buscar cuentas"
                className="w-52 px-2.5 py-2 text-[11px] outline-none placeholder:text-[#a0929b] max-[600px]:w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpiar búsqueda"
                  className="pr-2.5 text-[#a0929b] hover:text-[#493a45] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <Button onClick={() => setIsCreateOpen(true)} className="max-[600px]:w-full">
              <Plus size={15} className="mr-1.5" /> Crear cuenta
            </Button>
          </div>
        </div>

        {isPending && <p className="text-[11px] text-muted">Cargando cuentas…</p>}
        {isError && <p className="text-[11px] text-danger">No se pudieron cargar las cuentas.</p>}

        {visible && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2.5 bg-[#fbf9fa] border border-[#eee8ed] px-5 py-12 text-center text-[11px] text-[#948692]">
            <Users size={32} className="text-[#c4b7c1]" />
            <p className="font-medium text-[#493a45]">
              {search ? 'No se encontraron cuentas' : 'No hay cuentas registradas'}
            </p>
            <p className="text-[10px]">
              {search
                ? `No hay miembros del equipo que coincidan con "${search}".`
                : 'Crea una cuenta para autorizar el acceso al personal del panel.'}
            </p>
          </div>
        )}

        {visible && visible.length > 0 && (
          <div className="overflow-x-auto border border-[#eee8ed]">
            <table className="w-full min-w-160 border-collapse bg-white">
              <thead>
                <tr>
                  <th className={th}>Cuenta</th>
                  <th className={th}>Rol</th>
                  <th className={th}>Último ingreso</th>
                  <th className={th}>Estado</th>
                  <th className={`${th} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <AccountRow
                    key={user.id}
                    user={user}
                    onResetPassword={() => setResettingUser(user)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {/* Modal para Crear Cuenta */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Nueva cuenta del personal"
        description="Ingresa los datos para autorizar a un nuevo miembro del equipo con rol Personal."
      >
        <CreateStaffForm
          onSuccess={() => setIsCreateOpen(false)}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      {/* Modal para Restablecer Contraseña (fuera de la tabla) */}
      <Modal
        isOpen={!!resettingUser}
        onClose={() => setResettingUser(null)}
        title={`Restablecer contraseña: ${resettingUser?.name}`}
        description="Ingresa una nueva contraseña. Por seguridad se cerrarán todas sus sesiones activas."
      >
        {resettingUser && (
          <ResetPasswordForm
            user={resettingUser}
            onDone={() => setResettingUser(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function CreateStaffForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
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
      toast.success('Cuenta del personal creada exitosamente.');
      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear la cuenta.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="staff-name" label="Nombre completo *" error={errors.name?.message}>
        <Input
          placeholder="Ej. Laura Gómez"
          {...fieldA11y('staff-name', errors.name?.message)}
          {...register('name')}
        />
      </FormField>

      <FormField id="staff-email" label="Correo electrónico *" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="off"
          placeholder="ejemplo@skybeauty.co"
          {...fieldA11y('staff-email', errors.email?.message)}
          {...register('email')}
        />
      </FormField>

      <FormField
        id="staff-password"
        label="Contraseña inicial *"
        description="Mínimo 8 caracteres, al menos una mayúscula, un número y un símbolo."
        error={errors.password?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          {...fieldA11y('staff-password', errors.password?.message)}
          {...register('password')}
        />
      </FormField>

      <div className="flex justify-end gap-2.5 pt-3 border-t border-[#f0ecf0]">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </div>
    </form>
  );
}

function AccountRow({
  user,
  onResetPassword,
}: {
  user: AdminUser;
  onResetPassword: () => void;
}) {
  const queryClient = useQueryClient();
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
    <tr className="hover:bg-[#faf8f9] transition-colors">
      <td className={td}>
        <span className="block min-w-37.5 font-medium text-[#493a45]">
          {user.name}
          <small className="mt-0.5 block text-[9px] text-[#a4979e]">{user.email}</small>
        </span>
      </td>
      <td className={td}>
        <span className="font-semibold text-[#493a45]">{ROLE_LABELS[user.role]}</span>
      </td>
      <td className={td}>{formatDate(user.lastLoginAt)}</td>
      <td className={td}>
        {!user.isActive ? (
          <AdminStatus tone="out">Desactivada</AdminStatus>
        ) : locked ? (
          <AdminStatus tone="out">Bloqueada temporalmente</AdminStatus>
        ) : (
          <AdminStatus tone="ok">Activa</AdminStatus>
        )}
      </td>
      <td className={`${td} text-right`}>
        {isStaff && (
          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
            <Button variant="outline" size="sm" onClick={onResetPassword}>
              <KeyRound size={12} className="mr-1" />
              Restablecer
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
      toast.success(`Contraseña de ${user.name} restablecida exitosamente.`);
      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo restablecer la contraseña.'));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField
        id={id}
        label="Nueva contraseña temporal *"
        description="Mínimo 8 caracteres, al menos una mayúscula, un número y un símbolo."
        error={errors.newPassword?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          {...fieldA11y(id, errors.newPassword?.message)}
          {...register('newPassword')}
        />
      </FormField>

      <div className="flex justify-end gap-2.5 pt-3 border-t border-[#f0ecf0]">
        <Button variant="outline" type="button" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar nueva contraseña'}
        </Button>
      </div>
    </form>
  );
}
