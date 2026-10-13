'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError, apiFetch } from '@/lib/api';

/** Rastreador por código del pedido y teléfono de la compra (decisión del 2026-10-13). */
export function TrackOrderForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim() || !phone.trim()) {
      setError('Escribe el código del pedido y el teléfono con el que compraste.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { trackingPath } = await apiFetch<{ trackingPath: string }>('/store/orders/lookup', {
        method: 'POST',
        body: JSON.stringify({ code, phone }),
      });
      router.push(trackingPath);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Hiciste muchos intentos. Espera un minuto e inténtalo de nuevo.'
          : err instanceof ApiError && err.status === 404
            ? 'No encontramos un pedido con esos datos. Revisa el código y el teléfono.'
            : 'No pudimos buscar tu pedido. Intenta de nuevo en un momento.',
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-110 bg-[#faf6f8] p-6.25">
      <FormField id="track-code" label="Código del pedido">
        <Input
          id="track-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="SB-…"
          autoComplete="off"
          autoCapitalize="characters"
        />
      </FormField>
      <FormField
        id="track-phone"
        label="Teléfono de la compra"
        description="El mismo número que escribiste al hacer el pedido."
      >
        <Input
          id="track-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
        />
      </FormField>
      {error && <FormError>{error}</FormError>}
      <Button type="submit" className="mt-2 w-full" disabled={pending}>
        {pending ? 'Buscando...' : 'Ver mi pedido'} <ArrowRight size={16} />
      </Button>
    </form>
  );
}
