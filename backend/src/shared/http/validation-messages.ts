import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Mensajes en español para las reglas de class-validator que no traen un mensaje propio en el DTO.
 * Los mensajes escritos en los DTO se respetan; solo se reemplazan los predeterminados en inglés.
 */
const SPANISH: Record<string, (field: string, constraint: string) => string> = {
  whitelistValidation: (f) => `El campo "${f}" no está permitido.`,
  isDefined: (f) => `El campo "${f}" es obligatorio.`,
  isNotEmpty: (f) => `El campo "${f}" es obligatorio.`,
  isString: (f) => `El campo "${f}" debe ser texto.`,
  isBoolean: (f) => `El campo "${f}" debe ser verdadero o falso.`,
  isInt: (f) => `El campo "${f}" debe ser un número entero.`,
  isNumber: (f) => `El campo "${f}" debe ser un número válido.`,
  isPositive: (f) => `El campo "${f}" debe ser mayor que 0.`,
  min: (f, c) =>
    `El campo "${f}" ${c.replace(/^.* must not be less than (.+)$/, 'debe ser al menos $1')}.`,
  max: (f, c) =>
    `El campo "${f}" ${c.replace(/^.* must not be greater than (.+)$/, 'no puede superar $1')}.`,
  minLength: (f, c) =>
    `El campo "${f}" ${c.replace(/^.* must be longer than or equal to (\d+) characters?$/, 'debe tener al menos $1 caracteres')}.`,
  maxLength: (f, c) =>
    `El campo "${f}" ${c.replace(/^.* must be shorter than or equal to (\d+) characters?$/, 'admite como máximo $1 caracteres')}.`,
  isUuid: (f) => `El campo "${f}" debe ser un identificador válido.`,
  isEnum: (f) => `El campo "${f}" tiene un valor no permitido.`,
  isEmail: (f) => `El campo "${f}" debe ser un correo válido.`,
  isArray: (f) => `El campo "${f}" debe ser una lista.`,
  arrayMinSize: (f) => `La lista "${f}" no tiene suficientes elementos.`,
  arrayMaxSize: (f) => `La lista "${f}" tiene demasiados elementos.`,
  isDateString: (f) => `El campo "${f}" debe ser una fecha válida.`,
  isIso8601: (f) => `El campo "${f}" debe ser una fecha válida.`,
  matches: (f) => `El campo "${f}" no tiene el formato esperado.`,
  isUrl: (f) => `El campo "${f}" debe ser una dirección web válida.`,
};

/** Los mensajes predeterminados de class-validator están en inglés y nombran la propiedad. */
const ENGLISH_DEFAULT = /\b(must|should)\b/;

function collect(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([rule, message]) =>
      ENGLISH_DEFAULT.test(message) && SPANISH[rule] ? SPANISH[rule](field, message) : message,
    );
    return [...own, ...collect(error.children ?? [], field)];
  });
}

/** Fábrica de errores del ValidationPipe global: 400 con la lista de mensajes en español. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException(collect(errors));
}
