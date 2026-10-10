/**
 * Normaliza un número de WhatsApp al formato que se guarda: solo dígitos, con código de país y sin "+".
 * Un celular colombiano de 10 dígitos (empieza por 3) recibe el código 57 (ver Context/decisiones.md).
 * Ejemplos: "300 123 4567" → "573001234567"; "+57 300-123-4567" → "573001234567".
 */
export function normalizeWhatsappNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
}

/** Número de WhatsApp válido una vez normalizado: código de país + número, 11 a 15 dígitos. */
export const WHATSAPP_NUMBER_PATTERN = /^\d{11,15}$/;
