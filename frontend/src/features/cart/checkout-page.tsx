'use client';

import { ArrowRight, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiFetch, ApiError } from '@/lib/api';
import type { CreatedOrder } from '@/types/checkout';
import type { Location, StorePageSlug } from '@/types/store';
import { useCart } from './cart-context';
import { OrderSummary } from './order-summary';
import { useCartQuote } from './use-cart-quote';

type FormState = {
  customerName: string;
  customerPhone: string;
  departmentCode: string;
  municipalityCode: string;
  addressLine: string;
  deliveryNotes: string;
  paymentMethodId: string;
  termsAccepted: boolean;
  dataProcessingAccepted: boolean;
};

const emptyForm: FormState = {
  customerName: '',
  customerPhone: '',
  departmentCode: '',
  municipalityCode: '',
  addressLine: '',
  deliveryNotes: '',
  paymentMethodId: '',
  termsAccepted: false,
  dataProcessingAccepted: false,
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;

function validate(form: FormState, paymentAvailable: boolean): string | null {
  if (!form.customerName.trim()) return 'Escribe tu nombre completo.';
  if (!form.customerPhone.trim()) return 'Escribe tu número de teléfono.';
  if (!form.departmentCode || !form.municipalityCode) return 'Selecciona departamento y municipio.';
  if (!form.addressLine.trim()) return 'Escribe la dirección de entrega.';
  if (!form.paymentMethodId || !paymentAvailable) return 'Selecciona un método de pago disponible.';
  if (!form.termsAccepted || !form.dataProcessingAccepted) {
    return 'Debes marcar las dos casillas obligatorias.';
  }
  return null;
}

export function CheckoutPage({ publishedPages }: { publishedPages: StorePageSlug[] }) {
  const router = useRouter();
  const { items, ready, clear } = useCart();
  const [form, setForm] = useState<FormState>(emptyForm);
  // Una sola clave por intento de compra: si la respuesta se pierde y el cliente vuelve a enviar,
  // el servidor devuelve el mismo pedido en lugar de crear otro.
  const idempotencyKey = useRef<string | null>(null);
  const quoteQuery = useCartQuote(items, form.municipalityCode);
  const quote = quoteQuery.data ?? null;

  const departmentsQuery = useQuery({
    queryKey: ['store-departments'],
    queryFn: () => apiFetch<Location[]>('/store/locations/departments'),
  });

  const municipalitiesQuery = useQuery({
    queryKey: ['store-municipalities', form.departmentCode],
    enabled: Boolean(form.departmentCode),
    queryFn: () =>
      apiFetch<Location[]>(`/store/locations/departments/${form.departmentCode}/municipalities`),
  });

  const selectedPayment = useMemo(
    () => quote?.availablePaymentMethods.find((method) => method.id === form.paymentMethodId),
    [form.paymentMethodId, quote?.availablePaymentMethods],
  );

  const createOrder = useMutation({
    mutationFn: async () => {
      const validation = validate(form, Boolean(selectedPayment));
      if (validation) throw new Error(validation);
      idempotencyKey.current ??= crypto.randomUUID();
      return apiFetch<CreatedOrder>('/store/orders', {
        method: 'POST',
        body: JSON.stringify({
          items,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          municipalityCode: form.municipalityCode,
          addressLine: form.addressLine,
          deliveryNotes: form.deliveryNotes || undefined,
          paymentMethodId: form.paymentMethodId,
          idempotencyKey: idempotencyKey.current,
          termsAccepted: form.termsAccepted,
          dataProcessingAccepted: form.dataProcessingAccepted,
        }),
      });
    },
    onSuccess: (order) => {
      try {
        sessionStorage.setItem(`sky-beauty-order-${order.code}`, JSON.stringify(order));
      } catch {
        // Sin almacenamiento: la página del pedido muestra el enlace de seguimiento por otro medio.
      }
      idempotencyKey.current = null;
      clear();
      router.push(`/pedido/${order.code}`);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo crear el pedido.')),
  });

  if (!ready) {
    return <p className="text-[11px] text-muted">Cargando tu bolsa...</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-140 bg-[#faf6f8] px-6 py-15 text-center">
        <h1 className="font-serif mb-3 text-[38px]">Tu bolsa está vacía</h1>
        <p className="mb-6 text-xs leading-[1.8] text-[#88777e]">
          Agrega productos antes de continuar al checkout.
        </p>
        <Button asChild>
          <Link href="/productos">Ver productos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-12.5 max-[850px]:grid-cols-1">
      <form
        className="max-w-200"
        onSubmit={(event) => {
          event.preventDefault();
          createOrder.mutate();
        }}
      >
        <div className="mb-4.5 flex items-center gap-3 border border-[#e2d4de] bg-[#faf4f8] p-4.25 text-[11px] leading-[1.7] text-[#795d77]">
          <LockKeyhole size={19} className="shrink-0" />
          No necesitas cuenta. El pedido queda registrado y la conversación continúa por WhatsApp.
        </div>

        <section className="border-b border-[#ece4e8] py-7.5">
          <h2 className="font-serif mb-6 text-[25px]">Tus datos</h2>
          <div className="grid grid-cols-2 gap-4.5 max-[600px]:grid-cols-1">
            <FormField id="customerName" label="Nombre completo">
              <Input
                id="customerName"
                value={form.customerName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, customerName: event.target.value }))
                }
                autoComplete="name"
              />
            </FormField>
            <FormField id="customerPhone" label="Teléfono / WhatsApp">
              <Input
                id="customerPhone"
                value={form.customerPhone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, customerPhone: event.target.value }))
                }
                autoComplete="tel"
                placeholder="3001234567"
              />
            </FormField>
          </div>
        </section>

        <section className="border-b border-[#ece4e8] py-7.5">
          <h2 className="font-serif mb-6 text-[25px]">Entrega</h2>
          <div className="grid grid-cols-2 gap-4.5 max-[600px]:grid-cols-1">
            <FormField id="departmentCode" label="Departamento">
              <Select
                id="departmentCode"
                value={form.departmentCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    departmentCode: event.target.value,
                    municipalityCode: '',
                    paymentMethodId: '',
                  }))
                }
              >
                <option value="">Selecciona departamento</option>
                {(departmentsQuery.data ?? []).map((department) => (
                  <option key={department.code} value={department.code}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="municipalityCode" label="Municipio">
              <Select
                id="municipalityCode"
                value={form.municipalityCode}
                disabled={!form.departmentCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    municipalityCode: event.target.value,
                    paymentMethodId: '',
                  }))
                }
              >
                <option value="">Selecciona municipio</option>
                {(municipalitiesQuery.data ?? []).map((municipality) => (
                  <option key={municipality.code} value={municipality.code}>
                    {municipality.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id="addressLine"
              label="Dirección"
              className="col-span-2 max-[600px]:col-span-1"
            >
              <Input
                id="addressLine"
                value={form.addressLine}
                onChange={(event) =>
                  setForm((current) => ({ ...current, addressLine: event.target.value }))
                }
                autoComplete="street-address"
              />
            </FormField>
            <FormField
              id="deliveryNotes"
              label="Indicaciones adicionales"
              className="col-span-2 max-[600px]:col-span-1"
            >
              <Textarea
                id="deliveryNotes"
                rows={3}
                value={form.deliveryNotes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, deliveryNotes: event.target.value }))
                }
              />
            </FormField>
          </div>
          <p className="mt-3 text-[10px] leading-[1.7] text-[#a0929a]">
            El costo del envío depende de tu municipio. Si no tiene tarifa configurada, la tienda te
            lo confirma por WhatsApp.
          </p>
        </section>

        <section className="border-b border-[#ece4e8] py-7.5">
          <h2 className="font-serif mb-6 text-[25px]">Método de pago</h2>
          {!form.municipalityCode && (
            <p className="text-[11px] text-[#8b7f87]">
              Selecciona tu municipio para ver los métodos de pago disponibles.
            </p>
          )}
          {form.municipalityCode && quote?.availablePaymentMethods.length === 0 && (
            <FormError>No hay métodos de pago disponibles para este municipio y total.</FormError>
          )}
          <RadioGroup
            value={form.paymentMethodId}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, paymentMethodId: value }))
            }
            aria-label="Método de pago"
          >
            {(quote?.availablePaymentMethods ?? []).map((method) => (
              <label
                key={method.id}
                className="flex cursor-pointer items-center gap-3 border border-[#e7dde4] p-4 text-[11px] has-[[data-state=checked]]:border-[#ad81aa] has-[[data-state=checked]]:bg-[#faf5fa]"
              >
                <RadioGroupItem value={method.id} />
                <span>
                  <strong className="block">{method.name}</strong>
                  <small className="mt-1 block text-[#92808e]">
                    {method.requiresVerification
                      ? 'Envía el comprobante por WhatsApp; la tienda verifica el pago.'
                      : 'Pagas al recibir el pedido.'}
                  </small>
                </span>
              </label>
            ))}
          </RadioGroup>
          {selectedPayment?.instructions && (
            <div className="mt-3.5 border border-[#e7dde4] bg-[#fbf7fa] p-3.5 text-[11px] leading-[1.8] text-[#6f606a]">
              {selectedPayment.instructions}
            </div>
          )}
        </section>

        <section className="py-7.5">
          <label className="mb-2.5 flex items-start gap-2.5 text-[11px] leading-[1.7] text-[#5b4c56]">
            <Checkbox
              checked={form.termsAccepted}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, termsAccepted: checked === true }))
              }
              className="mt-1"
            />
            <span>
              Acepto los{' '}
              <TextLink slug="terminos" published={publishedPages}>
                términos y condiciones
              </TextLink>
              .
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[11px] leading-[1.7] text-[#5b4c56]">
            <Checkbox
              checked={form.dataProcessingAccepted}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, dataProcessingAccepted: checked === true }))
              }
              className="mt-1"
            />
            <span>
              Autorizo el{' '}
              <TextLink slug="datos-personales" published={publishedPages}>
                tratamiento de mis datos personales
              </TextLink>{' '}
              conforme a la Ley 1581 de 2012.
            </span>
          </label>
        </section>

        {quote && !quote.canCheckout && (
          <FormError>
            Hay productos de tu bolsa que necesitan revisión.{' '}
            <Link href="/carrito" className="underline">
              Volver a la bolsa
            </Link>
          </FormError>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={createOrder.isPending || !quote?.canCheckout}
        >
          {createOrder.isPending ? 'Creando pedido...' : 'Crear pedido'}
          <ArrowRight size={17} />
        </Button>
      </form>
      <OrderSummary quote={quote} checkout />
    </div>
  );
}

/** Enlace al texto publicado (en otra pestaña, para no perder el formulario); sin texto, solo el texto. */
function TextLink({
  slug,
  published,
  children,
}: {
  slug: StorePageSlug;
  published: StorePageSlug[];
  children: React.ReactNode;
}) {
  if (!published.includes(slug)) return <>{children}</>;
  return (
    <Link href={`/${slug}`} target="_blank" className="font-medium text-[#7a5178] underline">
      {children}
    </Link>
  );
}
