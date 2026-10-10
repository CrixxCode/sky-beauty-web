'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError, FormField, fieldA11y } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, apiFetch } from '@/lib/api';
import { loginSchema, type LoginValues } from '@/schemas/admin-auth';
import type { AdminProfile } from '@/types/admin';

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await apiFetch<AdminProfile>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      router.replace('/admin');
      router.refresh();
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'No se pudo iniciar sesión. Intenta de nuevo.',
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormField id="email" label="Correo" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="username"
          {...fieldA11y('email', errors.email?.message)}
          {...register('email')}
        />
      </FormField>
      <FormField id="password" label="Contraseña" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="current-password"
          {...fieldA11y('password', errors.password?.message)}
          {...register('password')}
        />
      </FormField>
      {serverError && <FormError>{serverError}</FormError>}
      <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  );
}
