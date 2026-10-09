'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, fieldA11y } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError, apiFetch } from '@/lib/api';
import { changePasswordSchema, type ChangePasswordValues } from '@/schemas/admin-auth';

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await apiFetch<void>('/admin/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      reset();
      toast.success('Contraseña actualizada. Se cerraron tus otras sesiones.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setError('currentPassword', { message: error.message });
      } else {
        toast.error('No se pudo cambiar la contraseña. Intenta de nuevo.');
      }
    }
  });

  const field = (name: keyof ChangePasswordValues, label: string, autoComplete: string) => (
    <FormField id={name} label={label} error={errors[name]?.message}>
      <Input
        type="password"
        autoComplete={autoComplete}
        {...fieldA11y(name, errors[name]?.message)}
        {...register(name)}
      />
    </FormField>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4">
      {field('currentPassword', 'Contraseña actual', 'current-password')}
      {field('newPassword', 'Contraseña nueva', 'new-password')}
      {field('confirmPassword', 'Confirma la contraseña nueva', 'new-password')}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}
