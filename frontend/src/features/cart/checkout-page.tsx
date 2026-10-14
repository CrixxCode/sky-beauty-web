'use client';

import { ArrowRight, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { fieldA11y, FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiFetch, ApiError } from '@/lib/api';
import { formatCOP } from '@/lib/format';
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

type FieldErrors = Partial<Record<keyof FormState, string>>;

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

/** Opciones del desplegable a 12px: se abren fuera del área de la tienda (portal). */
const storeSelectContent = '[&_[role=option]]:text-xs';

/** Orden de los campos en pantalla: el foco va al primero que tenga error. */
const FIELD_ORDER: Array<keyof FormState> = [
  'customerName',
  'customerPhone',
  'departmentCode',
  'municipalityCode',
  'addressLine',
  'paymentMethodId',
  'termsAccepted',
  'dataProcessingAccepted',
];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;

/** Mismas reglas mínimas que valida la API al crear el pedido (CreateOrderDto). */
function validate(form: FormState, paymentAvailable: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (form.customerName.trim().length < 2) errors.customerName = 'Escribe tu nombre completo.';
  if (!form.customerPhone.trim()) {
    errors.customerPhone = 'Escribe tu número de teléfono.';
  } else if (form.customerPhone.trim().length < 7) {
    errors.customerPhone = 'El número parece incompleto. Revísalo.';
  }
  if (!form.departmentCode) errors.departmentCode = 'Selecciona tu departamento.';
  if (!form.municipalityCode) errors.municipalityCode = 'Selecciona tu municipio.';
  if (!form.addressLine.trim()) {
    errors.addressLine = 'Escribe la dirección de entrega.';
  } else if (form.addressLine.trim().length < 5) {
    errors.addressLine = 'La dirección parece incompleta. Revísala.';
  }
  if (!form.paymentMethodId || !paymentAvailable) {
    errors.paymentMethodId = 'Elige un método de pago.';
  }
  if (!form.termsAccepted) {
    errors.termsAccepted = 'Debes aceptar los términos y condiciones para continuar.';
  }
  if (!form.dataProcessingAccepted) {
    errors.dataProcessingAccepted = 'Debes autorizar el tratamiento de tus datos para continuar.';
  }
  return errors;
}

/** Lleva el foco al control del campo (o a su primera opción, si es un grupo). */
function focusField(id: keyof FormState) {
  const element = document.getElementById(id);
  const target = element?.matches('input, textarea, button')
    ? element
    : element?.querySelector<HTMLElement>('button, input');
  target?.focus();
}

function isDirty(form: FormState) {
  return Boolean(form.customerName || form.customerPhone || form.addressLine || form.deliveryNotes);
}

export function CheckoutPage({ publishedPages }: { publishedPages: StorePageSlug[] }) {
  const router = useRouter();
  const { items, ready, clear, getCheckoutDraft, saveCheckoutDraft } = useCart();
  // El borrador vive en memoria: si el cliente va a la bolsa y vuelve, no pierde lo escrito.
  const [form, setForm] = useState<FormState>(
    () => (getCheckoutDraft() as FormState | null) ?? emptyForm,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  // Una sola clave por intento de compra: si la respuesta se pierde y el cliente vuelve a enviar,
  // el servidor devuelve el mismo pedido en lugar de crear otro.
  const idempotencyKey = useRef<string | null>(null);
  const quoteQuery = useCartQuote(items, form.municipalityCode);
  const quote = quoteQuery.data ?? null;
  const recalculating = quoteQuery.isPlaceholderData;

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
      saveCheckoutDraft(null);
      clear();
      router.push(`/pedido/${order.code}`);
    },
  });

  useEffect(() => {
    if (!createOrder.isSuccess) saveCheckoutDraft(form);
  }, [form, createOrder.isSuccess, saveCheckoutDraft]);

  // Aviso del navegador al recargar o cerrar la pestaña con datos escritos sin enviar.
  const warnOnLeave = isDirty(form) && !createOrder.isPending && !createOrder.isSuccess;
  useEffect(() => {
    if (!warnOnLeave) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [warnOnLeave]);

  /** Cambia campos y borra sus errores (los dependientes se limpian con ellos). */
  function update(changes: Partial<FormState>) {
    setForm((current) => ({ ...current, ...changes }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(changes) as Array<keyof FormState>) delete next[key];
      return next;
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(form, Boolean(selectedPayment));
    setErrors(nextErrors);
    const firstError = FIELD_ORDER.find((key) => nextErrors[key]);
    if (firstError) {
      focusField(firstError);
      return;
    }
    createOrder.mutate();
  }

  if (!ready || (items.length > 0 && !quote && quoteQuery.isPending)) {
    return (
      <p role="status" className="text-xs text-muted">
        Cargando tu bolsa…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-140 bg-[#faf6f8] px-6 py-15 text-center">
        <h2 className="mb-3 text-balance font-serif text-[38px] max-[600px]:text-[32px]">
          Tu bolsa está vacía
        </h2>
        <p className="mb-6 text-xs leading-[1.8] text-[#72646a]">
          Agrega productos antes de continuar al checkout.
        </p>
        <Button asChild>
          <Link href="/productos">Ver productos</Link>
        </Button>
      </div>
    );
  }

  const blocked = quote !== null && !quote.canCheckout;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-12.5 max-[850px]:grid-cols-1">
      <form className="max-w-200" noValidate onSubmit={onSubmit}>
        <div className="mb-4.5 flex items-center gap-3 border border-[#e2d4de] bg-[#faf4f8] p-4.25 text-xs leading-[1.7] text-[#6b5269]">
          <LockKeyhole size={19} className="shrink-0" />
          No necesitas cuenta. El pedido queda registrado y la conversación continúa por WhatsApp.
        </div>

        <section className="border-b border-[#ece4e8] py-7.5">
          <h2 className="mb-6 font-serif text-[25px]">Tus datos</h2>
          <div className="grid grid-cols-2 gap-x-4.5 max-[600px]:grid-cols-1">
            <FormField id="customerName" label="Nombre completo" error={errors.customerName}>
              <Input
                {...fieldA11y('customerName', errors.customerName)}
                name="name"
                value={form.customerName}
                onChange={(event) => update({ customerName: event.target.value })}
                autoComplete="name"
                autoCapitalize="words"
                maxLength={120}
              />
            </FormField>
            <FormField id="customerPhone" label="Teléfono / WhatsApp" error={errors.customerPhone}>
              <Input
                {...fieldA11y('customerPhone', errors.customerPhone)}
                name="tel"
                type="tel"
                inputMode="tel"
                value={form.customerPhone}
                onChange={(event) => update({ customerPhone: event.target.value })}
                autoComplete="tel"
                maxLength={30}
              />
            </FormField>
          </div>
        </section>

        <section className="border-b border-[#ece4e8] py-7.5">
          <h2 className="mb-6 font-serif text-[25px]">Entrega</h2>
          <div className="grid grid-cols-2 gap-x-4.5 max-[600px]:grid-cols-1">
            <FormField id="departmentCode" label="Departamento" error={errors.departmentCode}>
              <Select
                contentClassName={storeSelectContent}
                {...fieldA11y('departmentCode', errors.departmentCode)}
                value={form.departmentCode}
                onChange={(event) =>
                  update({
                    departmentCode: event.target.value,
                    municipalityCode: '',
                    paymentMethodId: '',
                  })
                }
              >
                <option value="">
                  {departmentsQuery.isPending
                    ? 'Cargando departamentos…'
                    : 'Selecciona departamento'}
                </option>
                {(departmentsQuery.data ?? []).map((department) => (
                  <option key={department.code} value={department.code}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="municipalityCode" label="Municipio" error={errors.municipalityCode}>
              <Select
                contentClassName={storeSelectContent}
                {...fieldA11y('municipalityCode', errors.municipalityCode)}
                value={form.municipalityCode}
                disabled={!form.departmentCode}
                onChange={(event) =>
                  update({ municipalityCode: event.target.value, paymentMethodId: '' })
                }
              >
                <option value="">
                  {form.departmentCode && municipalitiesQuery.isPending
                    ? 'Cargando municipios…'
                    : form.departmentCode
                      ? 'Selecciona municipio'
                      : 'Primero elige el departamento'}
                </option>
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
              error={errors.addressLine}
            >
              <Input
                {...fieldA11y('addressLine', errors.addressLine)}
                name="street-address"
                value={form.addressLine}
                onChange={(event) => update({ addressLine: event.target.value })}
                autoComplete="street-address"
                maxLength={220}
              />
            </FormField>
            <FormField
              id="deliveryNotes"
              label="Indicaciones adicionales (opcional)"
              className="col-span-2 max-[600px]:col-span-1"
            >
              <Textarea
                id="deliveryNotes"
                name="delivery-notes"
                rows={3}
                value={form.deliveryNotes}
                onChange={(event) => update({ deliveryNotes: event.target.value })}
                autoComplete="off"
                maxLength={300}
              />
            </FormField>
          </div>
          <p className="mt-1 text-xs leading-[1.7] text-[#70666c]">
            El costo del envío depende de tu municipio. Si no tiene tarifa configurada, la tienda te
            lo confirma por WhatsApp.
          </p>
        </section>

        <section className="border-b border-[#ece4e8] py-7.5" aria-labelledby="payment-title">
          <h2 id="payment-title" className="mb-6 font-serif text-[25px]">
            Método de pago
          </h2>
          {!form.municipalityCode && (
            <p className="text-xs text-[#6f666c]">
              Selecciona tu municipio para ver los métodos de pago disponibles.
            </p>
          )}
          {form.municipalityCode && recalculating && (
            <p role="status" className="text-xs text-[#6f666c]">
              Buscando los métodos de pago de tu municipio…
            </p>
          )}
          {form.municipalityCode &&
            !recalculating &&
            quote?.availablePaymentMethods.length === 0 && (
              <FormError>
                No hay métodos de pago disponibles para este municipio y total. Prueba con otro
                municipio de entrega o contacta a la tienda.
              </FormError>
            )}
          {form.municipalityCode && !recalculating && (
            <RadioGroup
              id="paymentMethodId"
              value={form.paymentMethodId}
              onValueChange={(value) => update({ paymentMethodId: value })}
              aria-labelledby="payment-title"
              aria-invalid={errors.paymentMethodId ? true : undefined}
              aria-describedby={errors.paymentMethodId ? 'paymentMethodId-error' : undefined}
            >
              {(quote?.availablePaymentMethods ?? []).map((method) => (
                <label
                  key={method.id}
                  className="flex cursor-pointer items-center gap-3 border border-[#e7dde4] p-4 text-xs hover:border-[#c9aac7] has-data-[state=checked]:border-[#ad81aa] has-data-[state=checked]:bg-[#faf5fa]"
                >
                  <RadioGroupItem value={method.id} />
                  <span>
                    <strong className="block">{method.name}</strong>
                    <small className="mt-1 block text-xs text-[#72646f]">
                      {method.requiresVerification
                        ? 'Envía el comprobante por WhatsApp; la tienda verifica el pago.'
                        : 'Pagas al recibir el pedido.'}
                    </small>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
          {errors.paymentMethodId && (
            <p id="paymentMethodId-error" className="mt-2 text-xs text-danger">
              {errors.paymentMethodId}
            </p>
          )}
          {selectedPayment?.instructions && (
            <div className="mt-3.5 whitespace-pre-line border border-[#e7dde4] bg-[#fbf7fa] p-3.5 text-xs leading-[1.8] text-[#6f606a]">
              {selectedPayment.instructions}
            </div>
          )}
        </section>

        <section className="py-7.5">
          <ConsentField
            id="termsAccepted"
            checked={form.termsAccepted}
            onChange={(checked) => update({ termsAccepted: checked })}
            error={errors.termsAccepted}
          >
            Acepto los{' '}
            <TextLink slug="terminos" published={publishedPages}>
              términos y condiciones
            </TextLink>
            .
          </ConsentField>
          <ConsentField
            id="dataProcessingAccepted"
            checked={form.dataProcessingAccepted}
            onChange={(checked) => update({ dataProcessingAccepted: checked })}
            error={errors.dataProcessingAccepted}
          >
            Autorizo el{' '}
            <TextLink slug="datos-personales" published={publishedPages}>
              tratamiento de mis datos personales
            </TextLink>{' '}
            conforme a la Ley 1581 de 2012.
          </ConsentField>
        </section>

        {blocked && (
          <FormError>
            <span id="checkout-blocked">
              Hay productos de tu bolsa que necesitan revisión.{' '}
              <Link href="/carrito" className="underline">
                Volver a la bolsa
              </Link>
            </span>
          </FormError>
        )}
        {createOrder.isError && (
          <FormError>
            {errorMessage(createOrder.error, 'No se pudo crear el pedido.')} Revisa los datos e
            intenta de nuevo.
          </FormError>
        )}

        {/* En celular el resumen queda debajo del formulario: el total se repite junto al botón. */}
        {quote && (
          <div className="mb-4 hidden items-center justify-between gap-3 border-t border-[#e5d9e2] pt-4 text-[13px] font-semibold max-[850px]:flex">
            <span>
              {quote.shippingCost === null ? 'Total sin envío' : 'Total'}
              <a
                href="#resumen"
                className="ml-2 text-xs font-normal text-[#764b77] underline underline-offset-4"
              >
                Ver detalle
              </a>
            </span>
            <strong className="text-[19px] tabular-nums">{formatCOP(quote.total)}</strong>
          </div>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={createOrder.isPending || recalculating || blocked}
          aria-describedby={blocked ? 'checkout-blocked' : undefined}
        >
          {createOrder.isPending
            ? 'Creando pedido…'
            : recalculating
              ? 'Actualizando el total…'
              : 'Crear pedido'}
          <ArrowRight size={17} />
        </Button>
      </form>
      <OrderSummary quote={quote} checkout updating={recalculating} />
    </div>
  );
}

function ConsentField({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: keyof FormState;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="flex cursor-pointer items-start gap-2.5 py-1 text-xs leading-[1.7] text-[#5b4c56]">
        <Checkbox
          {...fieldA11y(id, error)}
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          className="mt-0.75"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="ml-6.5 text-xs text-danger">
          {error}
        </p>
      )}
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
    <Link
      href={`/${slug}`}
      target="_blank"
      className="font-medium text-[#7a5178] underline hover:text-[#5b365b]"
    >
      {children}
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </Link>
  );
}
