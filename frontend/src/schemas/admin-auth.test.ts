import { changePasswordSchema, createStaffSchema, loginSchema } from './admin-auth';

describe('esquemas de acceso al panel', () => {
  it('valida el correo y exige la contraseña al iniciar sesión', () => {
    expect(loginSchema.safeParse({ email: 'duena@ejemplo.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'no-es-correo', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'duena@ejemplo.com', password: '' }).success).toBe(false);
  });

  it('exige 12 caracteres y confirmación igual en el cambio de contraseña', () => {
    const base = { currentPassword: 'actual', newPassword: 'nueva-clave-12', confirmPassword: '' };
    expect(
      changePasswordSchema.safeParse({ ...base, confirmPassword: 'nueva-clave-12' }).success,
    ).toBe(true);

    const mismatch = changePasswordSchema.safeParse({ ...base, confirmPassword: 'otra-clave-12' });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0].path).toEqual(['confirmPassword']);

    const short = changePasswordSchema.safeParse({
      ...base,
      newPassword: 'corta',
      confirmPassword: 'corta',
    });
    expect(short.success).toBe(false);
  });

  it('recorta el nombre al crear una cuenta del personal', () => {
    const result = createStaffSchema.parse({
      name: '  Ana  ',
      email: 'ana@ejemplo.com',
      password: 'clave-segura-123',
    });
    expect(result.name).toBe('Ana');
  });
});
