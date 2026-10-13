import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MunicipalShippingRate, Prisma, StoreSettings } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type {
  PublicStoreInfoDto,
  ShippingRateDto,
  StoreSettingsDto,
  UpdateStoreSettingsDto,
  UpsertShippingRateDto,
} from './store-settings.dto';

const SETTINGS_ID = 'default';

@Injectable()
export class StoreSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<StoreSettingsDto> {
    return toDto(await this.ensure());
  }

  async update(dto: UpdateStoreSettingsDto): Promise<StoreSettingsDto> {
    await this.ensure();
    const settings = await this.prisma.storeSettings.update({
      where: { id: SETTINGS_ID },
      data: dto,
    });
    return toDto(settings);
  }

  async listShippingRates(): Promise<ShippingRateDto[]> {
    const rates = await this.prisma.municipalShippingRate.findMany({
      include: { municipality: { include: { department: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rates
      .map(toShippingRateDto)
      .sort((a, b) =>
        `${a.departmentName} ${a.municipalityName}`.localeCompare(
          `${b.departmentName} ${b.municipalityName}`,
          'es',
        ),
      );
  }

  async upsertShippingRate(dto: UpsertShippingRateDto): Promise<ShippingRateDto> {
    const municipality = await this.prisma.municipality.findUnique({
      where: { code: dto.municipalityCode },
    });
    if (!municipality) {
      throw new BadRequestException('El municipio seleccionado no existe.');
    }

    const rate = await this.prisma.municipalShippingRate.upsert({
      where: { municipalityCode: dto.municipalityCode },
      create: { municipalityCode: dto.municipalityCode, amount: dto.amount },
      update: { amount: dto.amount },
      include: { municipality: { include: { department: true } } },
    });
    return toShippingRateDto(rate);
  }

  async deleteShippingRate(id: string): Promise<void> {
    const rate = await this.prisma.municipalShippingRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException('No existe esa tarifa de envio.');
    await this.prisma.municipalShippingRate.delete({ where: { id } });
  }

  async getPublicInfo(): Promise<PublicStoreInfoDto> {
    const s = await this.ensure();
    return {
      storeName: s.storeName,
      whatsappNumber: s.whatsappNumber,
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      addressText: s.addressText,
      businessHours: s.businessHours,
      instagramUrl: s.instagramUrl,
      facebookUrl: s.facebookUrl,
      tiktokUrl: s.tiktokUrl,
      heroTitle: s.heroTitle,
      heroSubtitle: s.heroSubtitle,
    };
  }

  /** La fila única normalmente la crea el script de datos iniciales; si falta, se crea vacía. */
  private ensure(): Promise<StoreSettings> {
    return this.prisma.storeSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    });
  }
}

function toDto(s: StoreSettings): StoreSettingsDto {
  return {
    storeName: s.storeName,
    whatsappNumber: s.whatsappNumber,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    addressText: s.addressText,
    businessHours: s.businessHours,
    instagramUrl: s.instagramUrl,
    facebookUrl: s.facebookUrl,
    tiktokUrl: s.tiktokUrl,
    nationalFreeShipping: s.nationalFreeShipping,
    freeShippingThreshold: s.freeShippingThreshold?.toNumber() ?? null,
    defaultLowStockThreshold: s.defaultLowStockThreshold,
    maxPercentageDiscount: s.maxPercentageDiscount?.toNumber() ?? null,
  };
}

function toShippingRateDto(
  rate: MunicipalShippingRate & {
    municipality: Prisma.MunicipalityGetPayload<{ include: { department: true } }>;
  },
): ShippingRateDto {
  return {
    id: rate.id,
    municipalityCode: rate.municipalityCode,
    municipalityName: rate.municipality.name,
    departmentName: rate.municipality.department.name,
    amount: rate.amount.toNumber(),
  };
}
