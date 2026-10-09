'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError, apiFetch } from '@/lib/api';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await apiFetch<void>('/admin/auth/logout', { method: 'POST' });
    } catch (error) {
      // Si la sesión ya no era válida, igual se vuelve al inicio de sesión.
      if (!(error instanceof ApiError && error.status === 401)) {
        toast.error('No se pudo cerrar la sesión. Intenta de nuevo.');
        setPending(false);
        return;
      }
    }
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout} disabled={pending}>
      Cerrar sesión
    </Button>
  );
}
