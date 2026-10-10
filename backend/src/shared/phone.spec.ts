import { normalizeWhatsappNumber, WHATSAPP_NUMBER_PATTERN } from './phone';

describe('normalizeWhatsappNumber', () => {
  it.each([
    ['3001234567', '573001234567'],
    ['300 123 4567', '573001234567'],
    ['573001234567', '573001234567'],
    ['+57 300-123-4567', '573001234567'],
    ['(+57) 300 123 45 67', '573001234567'],
  ])('normaliza %p a %p', (input, expected) => {
    expect(normalizeWhatsappNumber(input)).toBe(expected);
    expect(WHATSAPP_NUMBER_PATTERN.test(normalizeWhatsappNumber(input))).toBe(true);
  });

  it('no agrega 57 a números que no son celulares colombianos de 10 dígitos', () => {
    expect(normalizeWhatsappNumber('6015551234')).toBe('6015551234');
    expect(WHATSAPP_NUMBER_PATTERN.test('6015551234')).toBe(false);
  });
});
