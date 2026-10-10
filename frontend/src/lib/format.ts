const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Formatea un valor en pesos colombianos, p. ej. 150000 → "$ 150.000". */
export function formatCOP(value: number): string {
  return copFormatter.format(value);
}

/**
 * Normaliza un número de WhatsApp como lo hace el backend (backend/src/shared/phone.ts):
 * solo dígitos y, si es un celular colombiano de 10 dígitos, con el 57 delante.
 */
export function normalizeWhatsappNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
}

/** Enlace para abrir un chat de WhatsApp con un número ya normalizado. */
export function whatsappUrl(number: string): string {
  return `https://wa.me/${number}`;
}
