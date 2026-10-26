import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Carrier, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type {
  CarrierDto,
  CarrierRateDto,
  CreateCarrierDto,
  UpdateCarrierDto,
  UpsertCarrierRateDto,
} from './shipping.dto';

const RATE_INCLUDE = { municipality: { include: { department: true } } } as const;
type CarrierRateRow = Prisma.CarrierShippingRateGetPayload<{ include: typeof RATE_INCLUDE }>;

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

  async listRates(carrierId: string): Promise<CarrierRateDto[]> {
    await this.findCarrier(carrierId);
    const rates = await this.prisma.carrierShippingRate.findMany({
      where: { carrierId },
      include: RATE_INCLUDE,
    });
    return rates
      .map(toCarrierRateDto)
      .sort((a, b) =>
        `${a.departmentName} ${a.municipalityName}`.localeCompare(
          `${b.departmentName} ${b.municipalityName}`,
          'es',
        ),
      );
  }

  async upsertRate(carrierId: string, dto: UpsertCarrierRateDto): Promise<CarrierRateDto> {
    await this.findCarrier(carrierId);
    const municipality = await this.prisma.municipality.findUnique({
      where: { code: dto.municipalityCode },
    });
    if (!municipality) throw new BadRequestException('El municipio seleccionado no existe.');

    const rate = await this.prisma.carrierShippingRate.upsert({
      where: {
        carrierId_municipalityCode: { carrierId, municipalityCode: dto.municipalityCode },
      },
      create: { carrierId, municipalityCode: dto.municipalityCode, amount: dto.amount },
      update: { amount: dto.amount },
      include: RATE_INCLUDE,
    });
    return toCarrierRateDto(rate);
  }

  async deleteRate(carrierId: string, rateId: string): Promise<void> {
    const { count } = await this.prisma.carrierShippingRate.deleteMany({
      where: { id: rateId, carrierId },
    });
    if (count === 0) throw new NotFoundException('No existe esa tarifa de la transportadora.');
  }

  private async findCarrier(id: string): Promise<Carrier> {
    const carrier = await this.prisma.carrier.findUnique({ where: { id } });
    if (!carrier) throw new NotFoundException('No existe esa transportadora.');
    return carrier;
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

function toCarrierRateDto(rate: CarrierRateRow): CarrierRateDto {
  return {
    id: rate.id,
    carrierId: rate.carrierId,
    municipalityCode: rate.municipalityCode,
    municipalityName: rate.municipality.name,
    departmentName: rate.municipality.department.name,
    amount: rate.amount.toNumber(),
  };
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
