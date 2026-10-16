import { testimonialPayload, testimonialSchema, type TestimonialFormValues } from './testimonials';

const valid: TestimonialFormValues = {
  firstName: 'Clienta',
  lastInitial: 'F',
  rating: '5',
  comment: 'Comentario ficticio de prueba.',
  productId: '',
  isPublished: false,
};

const accepts = (changes: Partial<TestimonialFormValues>) =>
  testimonialSchema.safeParse({ ...valid, ...changes }).success;

describe('testimonialSchema (mismos límites que el backend)', () => {
  it('acepta un testimonio válido', () => {
    expect(accepts({})).toBe(true);
  });

  it('exige el nombre y admite hasta 60 caracteres', () => {
    expect(accepts({ firstName: '   ' })).toBe(false);
    expect(accepts({ firstName: 'a'.repeat(60) })).toBe(true);
    expect(accepts({ firstName: 'a'.repeat(61) })).toBe(false);
  });

  it('la inicial es una sola letra, con o sin punto', () => {
    expect(accepts({ lastInitial: 'G.' })).toBe(true);
    expect(accepts({ lastInitial: 'Ñ' })).toBe(true);
    expect(accepts({ lastInitial: '' })).toBe(false);
    expect(accepts({ lastInitial: 'Go' })).toBe(false);
    expect(accepts({ lastInitial: '1' })).toBe(false);
  });

  it('la valoración va de 1 a 5', () => {
    expect(accepts({ rating: '1' })).toBe(true);
    expect(accepts({ rating: '0' })).toBe(false);
    expect(accepts({ rating: '6' })).toBe(false);
    expect(accepts({ rating: '' })).toBe(false);
  });

  it('exige el comentario y admite hasta 600 caracteres', () => {
    expect(accepts({ comment: ' ' })).toBe(false);
    expect(accepts({ comment: 'a'.repeat(600) })).toBe(true);
    expect(accepts({ comment: 'a'.repeat(601) })).toBe(false);
  });
});

describe('testimonialPayload', () => {
  it('envía la inicial en mayúscula y sin punto, la valoración como número y sin producto como null', () => {
    expect(
      testimonialPayload({ ...valid, firstName: ' Clienta ', lastInitial: 'g.', rating: '4' }),
    ).toEqual({
      firstName: 'Clienta',
      lastInitial: 'G',
      rating: 4,
      comment: 'Comentario ficticio de prueba.',
      productId: null,
      isPublished: false,
    });
  });
});
