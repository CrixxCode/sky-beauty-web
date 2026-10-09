import { z } from 'zod';

/** Debe coincidir con MIN_PASSWORD_LENGTH del backend (backend/src/shared/security/password.ts). */
export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  .max(MAX_PASSWORD_LENGTH, 'Es demasiado larga.');

export const loginSchema = z.object({
  email: z.email('Ingresa un correo válido.'),
  password: z.string().min(1, 'Ingresa la contraseña.').max(MAX_PASSWORD_LENGTH),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual.'),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa el nombre.').max(100, 'Máximo 100 caracteres.'),
  email: z.email('Ingresa un correo válido.'),
  password: newPassword,
});
export type CreateStaffValues = z.infer<typeof createStaffSchema>;

export const resetPasswordSchema = z.object({ newPassword });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
