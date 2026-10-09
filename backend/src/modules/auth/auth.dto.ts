import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminRole } from '../../generated/prisma/client';
import { MIN_PASSWORD_LENGTH } from '../../shared/security/password';

/** Longitud máxima de contraseña: evita cálculos de hash costosos con entradas enormes. */
export const MAX_PASSWORD_LENGTH = 200;

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @ApiProperty({ example: 'propietaria@ejemplo.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Ingresa la contraseña.' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Ingresa tu contraseña actual.' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword!: string;

  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  })
  @MaxLength(MAX_PASSWORD_LENGTH)
  newPassword!: string;
}

export class AdminProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: AdminRole }) role!: AdminRole;
}

export { normalizeEmail };
