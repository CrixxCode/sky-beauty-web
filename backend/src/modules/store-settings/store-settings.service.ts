import { Injectable } from '@nestjs/common';
import type { StoreSettings } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type {
  PublicStoreInfoDto,
  StoreSettingsDto,
  UpdateStoreSettingsDto,
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
    freeShippingThreshold: s.freeShippingThreshold?.toNumber() ?? null,
    defaultLowStockThreshold: s.defaultLowStockThreshold,
    maxPercentageDiscount: s.maxPercentageDiscount?.toNumber() ?? null,
  };
}
