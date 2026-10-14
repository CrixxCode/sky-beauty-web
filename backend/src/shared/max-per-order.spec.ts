import { effectiveMaxPerOrder } from './max-per-order';

describe('effectiveMaxPerOrder', () => {
  it('gana el menor entre el de la variante y el tope general', () => {
    expect(effectiveMaxPerOrder(2, 5)).toBe(2);
    expect(effectiveMaxPerOrder(8, 5)).toBe(5);
  });

  it('sin uno de los dos, aplica el otro; sin ninguno, no hay límite', () => {
    expect(effectiveMaxPerOrder(null, 5)).toBe(5);
    expect(effectiveMaxPerOrder(3, null)).toBe(3);
    expect(effectiveMaxPerOrder(null, null)).toBeNull();
  });
});
