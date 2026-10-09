import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdminRole } from '../../generated/prisma/client';
import { MIN_PASSWORD_LENGTH } from '../../shared/security/password';
import { MAX_PASSWORD_LENGTH, normalizeEmail } from '../auth/auth.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const passwordMessage = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;

export class CreateStaffDto {
  @ApiProperty({ example: 'personal@ejemplo.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  email!: string;

  @ApiProperty({ example: 'Nombre del personal' })
  @Transform(trim)
  @IsString()
  @Length(1, 100, { message: 'El nombre debe tener entre 1 y 100 caracteres.' })
  name!: string;

  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, { message: passwordMessage })
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100, { message: 'El nombre debe tener entre 1 y 100 caracteres.' })
  name?: string;

  @ApiPropertyOptional({ description: 'false desactiva la cuenta y cierra sus sesiones.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, { message: passwordMessage })
  @MaxLength(MAX_PASSWORD_LENGTH)
  newPassword!: string;
}

export class AdminUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: AdminRole }) role!: AdminRole;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ nullable: true, type: Date }) lockedUntil!: Date | null;
  @ApiProperty({ nullable: true, type: Date }) lastLoginAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}
