'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fieldA11y, FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError, apiFetch } from '@/lib/api';

type Errors = { code?: string; phone?: string };

/** Rastreador por código del pedido y teléfono de la compra (decisión del 2026-10-13). */
export function TrackOrderForm() {
  const router = useRouter();
  const codeRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Errors = {
      code: code.trim() ? undefined : 'Escribe el código del pedido.',
      phone: phone.trim() ? undefined : 'Escribe el teléfono con el que compraste.',
    };
    setErrors(nextErrors);
    if (nextErrors.code) return codeRef.current?.focus();
    if (nextErrors.phone) return phoneRef.current?.focus();

    setPending(true);
    setError(null);
    try {
      const { trackingPath } = await apiFetch<{ trackingPath: string }>('/store/orders/lookup', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim(), phone }),
      });
      router.push(trackingPath);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Hiciste muchos intentos. Espera un minuto e inténtalo de nuevo.'
          : err instanceof ApiError && err.status === 404
            ? 'No encontramos un pedido con esos datos. Revisa el código y el teléfono.'
            : 'No pudimos buscar tu pedido. Revisa tu conexión e intenta de nuevo.',
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-110 bg-[#faf6f8] p-6.25">
      <FormField id="track-code" label="Código del pedido" error={errors.code}>
        <Input
          ref={codeRef}
          {...fieldA11y('track-code', errors.code)}
          name="order-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setErrors((current) => ({ ...current, code: undefined }));
          }}
          placeholder="SB-…"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          translate="no"
        />
      </FormField>
      <FormField
        id="track-phone"
        label="Teléfono de la compra"
        description="El mismo número que escribiste al hacer el pedido."
        error={errors.phone}
      >
        <Input
          ref={phoneRef}
          {...fieldA11y('track-phone', errors.phone)}
          name="tel"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            setErrors((current) => ({ ...current, phone: undefined }));
          }}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
        />
      </FormField>
      {error && <FormError>{error}</FormError>}
      <Button type="submit" className="mt-2 w-full" disabled={pending}>
        {pending ? 'Buscando…' : 'Ver mi pedido'} <ArrowRight size={16} />
      </Button>
    </form>
  );
}
