import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Carrier } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { CarrierDto, CreateCarrierDto, UpdateCarrierDto } from './shipping.dto';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async listCarriers(): Promise<CarrierDto[]> {
    const carriers = await this.prisma.carrier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return carriers.map(toCarrierDto);
  }

  async createCarrier(dto: CreateCarrierDto): Promise<CarrierDto> {
    const data = this.normalizeCarrierInput(dto);
    if (!data.name) throw new BadRequestException('Escribe el nombre de la transportadora.');
    try {
      const carrier = await this.prisma.carrier.create({
        data: {
          name: data.name,
          trackingUrlTemplate: data.trackingUrlTemplate,
          phone: data.phone,
          isActive: data.isActive ?? true,
        },
      });
      return toCarrierDto(carrier);
    } catch (err: unknown) {
      throw duplicateNameError(err);
    }
  }

  async updateCarrier(id: string, dto: UpdateCarrierDto): Promise<CarrierDto> {
    const existing = await this.prisma.carrier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('No existe esa transportadora.');

    const data = this.normalizeCarrierInput(dto);
    if (data.name === '') throw new BadRequestException('Escribe el nombre de la transportadora.');
    try {
      const carrier = await this.prisma.carrier.update({ where: { id }, data });
      return toCarrierDto(carrier);
    } catch (err: unknown) {
      throw duplicateNameError(err);
    }
  }

  private normalizeCarrierInput(dto: CreateCarrierDto | UpdateCarrierDto) {
    const name = dto.name?.trim();
    const trackingUrlTemplate =
      dto.trackingUrlTemplate === null ? null : dto.trackingUrlTemplate?.trim() || undefined;
    const phone = dto.phone === null ? null : dto.phone?.trim() || undefined;

    if (trackingUrlTemplate && !trackingUrlTemplate.includes('{tracking}')) {
      throw new BadRequestException('La plantilla de seguimiento debe incluir {tracking}.');
    }

    return {
      ...(name !== undefined ? { name } : {}),
      ...(trackingUrlTemplate !== undefined ? { trackingUrlTemplate } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }
}

/** Nombre repetido (restricción única) → 409; cualquier otro error se propaga igual. */
function duplicateNameError(err: unknown): unknown {
  if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
    return new ConflictException('Ya existe una transportadora con ese nombre.');
  }
  return err;
}

function toCarrierDto(carrier: Carrier): CarrierDto {
  return {
    id: carrier.id,
    name: carrier.name,
    trackingUrlTemplate: carrier.trackingUrlTemplate,
    phone: carrier.phone,
    isActive: carrier.isActive,
    createdAt: carrier.createdAt,
    updatedAt: carrier.updatedAt,
  };
}
