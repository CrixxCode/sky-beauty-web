import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { PaymentMethodDto, UpdatePaymentMethodDto } from './payment-methods.dto';

const WITH_CITIES = {
  cities: {
    include: { municipality: { include: { department: true } } },
    orderBy: { municipality: { name: 'asc' } },
  },
} satisfies Prisma.PaymentMethodInclude;

type MethodWithCities = Prisma.PaymentMethodGetPayload<{ include: typeof WITH_CITIES }>;

/**
 * Métodos de pago (ver Context/decisiones.md):
 * - Transferencia, Nequi y Daviplata no se activan sin instrucciones.
 * - El contra entrega se ofrece solo en los municipios configurados y hasta un total máximo.
 */
@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PaymentMethodDto[]> {
    const methods = await this.prisma.paymentMethod.findMany({
      include: WITH_CITIES,
      orderBy: { position: 'asc' },
    });
    return methods.map(toDto);
  }

  async update(id: string, dto: UpdatePaymentMethodDto): Promise<PaymentMethodDto> {
    const method = await this.findOrThrow(id);

    if (dto.maxOrderTotal !== undefined && !method.restrictToCities) {
      throw new BadRequestException(`${method.name} no admite un total máximo de pedido.`);
    }

    const nextActive = dto.isActive ?? method.isActive;
    const nextInstructions =
      dto.instructions !== undefined ? dto.instructions : method.instructions;
    if (method.requiresVerification && nextActive && !nextInstructions) {
      throw new BadRequestException(
        `Para activar ${method.name} escribe primero sus instrucciones de pago.`,
      );
    }

    const updated = await this.prisma.paymentMethod.update({
      where: { id },
      data: {
        instructions: dto.instructions,
        isActive: dto.isActive,
        maxOrderTotal: dto.maxOrderTotal,
      },
      include: WITH_CITIES,
    });
    return toDto(updated);
  }

  /** Reemplaza la lista de municipios donde se ofrece un método restringido por municipio. */
  async setCities(id: string, municipalityCodes: string[]): Promise<PaymentMethodDto> {
    const method = await this.findOrThrow(id);
    if (!method.restrictToCities) {
      throw new BadRequestException(`${method.name} no se restringe por municipio.`);
    }

    const found = await this.prisma.municipality.count({
      where: { code: { in: municipalityCodes } },
    });
    if (found !== municipalityCodes.length) {
      throw new BadRequestException(
        'Uno o más municipios no existen en la lista oficial del DANE.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.paymentMethodCity.deleteMany({ where: { paymentMethodId: id } }),
      this.prisma.paymentMethodCity.createMany({
        data: municipalityCodes.map((municipalityCode) => ({
          paymentMethodId: id,
          municipalityCode,
        })),
      }),
    ]);
    return toDto(
      await this.prisma.paymentMethod.findUniqueOrThrow({ where: { id }, include: WITH_CITIES }),
    );
  }

  private async findOrThrow(id: string) {
    const method = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!method) throw new NotFoundException('No existe ese método de pago.');
    return method;
  }
}

function toDto(m: MethodWithCities): PaymentMethodDto {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    instructions: m.instructions,
    requiresVerification: m.requiresVerification,
    restrictToCities: m.restrictToCities,
    maxOrderTotal: m.maxOrderTotal?.toNumber() ?? null,
    isActive: m.isActive,
    cities: m.cities.map((c) => ({
      municipalityCode: c.municipalityCode,
      municipalityName: c.municipality.name,
      departmentName: c.municipality.department.name,
    })),
  };
}
