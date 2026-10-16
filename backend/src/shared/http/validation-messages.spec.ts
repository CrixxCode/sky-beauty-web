import { ValidationPipe } from '@nestjs/common';
import { IsInt, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { validationExceptionFactory } from './validation-messages';

class Item {
  @IsInt()
  @Min(1)
  quantity!: number;
}

class Body {
  @IsString()
  @MaxLength(5)
  name!: string;

  @IsString({ message: 'Escribe la descripción.' })
  description!: string;

  @ValidateNested({ each: true })
  @Type(() => Item)
  items!: Item[];
}

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

async function messagesFor(value: unknown): Promise<string[]> {
  try {
    await pipe.transform(value, { type: 'body', metatype: Body });
    return [];
  } catch (error) {
    return (error as { getResponse(): { message: string[] } }).getResponse().message;
  }
}

describe('validationExceptionFactory', () => {
  it('traduce los mensajes predeterminados y respeta los escritos en el DTO', async () => {
    const messages = await messagesFor({
      name: 'demasiado largo',
      description: 5,
      items: [{ quantity: 0, unitPrice: 1 }],
      role: 'ADMIN',
    });
    expect(messages).toEqual(
      expect.arrayContaining([
        'El campo "role" no está permitido.',
        'El campo "name" admite como máximo 5 caracteres.',
        'Escribe la descripción.',
        'El campo "items.0.quantity" debe ser al menos 1.',
        'El campo "items.0.unitPrice" no está permitido.',
      ]),
    );
    expect(messages.some((m) => /\b(must|should)\b/.test(m))).toBe(false);
  });
});
