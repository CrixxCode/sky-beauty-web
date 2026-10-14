import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MunicipalShippingRate, Prisma, StoreSettings } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  STORE_PAGES,
  type PublicStorePageDto,
  type StoreContentDto,
  type StorePageSlug,
  type UpdateStoreContentDto,
} from './content.dto';
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
    const settings = await this.prisma.$transaction(async (tx) => {
      if (dto.maxPercentageDiscount != null) {
        await this.assertNoPromotionAbove(tx, dto.maxPercentageDiscount);
      }
      return tx.storeSettings.update({ where: { id: SETTINGS_ID }, data: dto });
    });
    return toDto(settings);
  }

  /**
   * Decisión del 2026-10-13: no se puede bajar el límite del descuento porcentual mientras haya
   * promociones activas, vigentes o programadas, que lo superen. Las vencidas o inactivas no
   * bloquean: si se reactivan o editan, se validan contra el límite vigente.
   */
  private async assertNoPromotionAbove(tx: Prisma.TransactionClient, limit: number): Promise<void> {
    const conflicting = await tx.promotion.findMany({
      where: {
        discountType: 'PERCENTAGE',
        isActive: true,
        endsAt: { gte: new Date() },
        discountValue: { gt: limit },
      },
      select: { name: true, discountValue: true },
      orderBy: { discountValue: 'desc' },
    });
    if (conflicting.length === 0) return;

    const list = conflicting
      .map((p) => `${p.name} (${p.discountValue.toNumber().toLocaleString('es-CO')} %)`)
      .join(', ');
    throw new BadRequestException(
      `No se puede bajar el límite a ${limit.toLocaleString('es-CO')} %: estas promociones lo superan: ${list}. Edítalas o desactívalas primero.`,
    );
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
    if (!rate) throw new NotFoundException('No existe esa tarifa de envío.');
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
      tagline: s.tagline,
      announcementText: s.announcementText,
      publishedPages: (Object.keys(STORE_PAGES) as StorePageSlug[]).filter(
        (slug) => s[STORE_PAGES[slug].field],
      ),
    };
  }

  // ── Contenido (módulo 12) ──────────────────────────────────────────────────

  async getContent(): Promise<StoreContentDto> {
    return toContentDto(await this.ensure());
  }

  async updateContent(dto: UpdateStoreContentDto): Promise<StoreContentDto> {
    await this.ensure();
    const settings = await this.prisma.storeSettings.update({
      where: { id: SETTINGS_ID },
      data: dto,
    });
    return toContentDto(settings);
  }

  /** Página de texto publicada. Sin texto cargado no existe (404), para no publicar borradores. */
  async getPage(slug: string): Promise<PublicStorePageDto> {
    if (!Object.hasOwn(STORE_PAGES, slug)) throw new NotFoundException('No existe esa página.');
    const page = STORE_PAGES[slug as StorePageSlug];
    const settings = await this.ensure();
    const text = settings[page.field];
    if (!text) throw new NotFoundException('No existe esa página.');
    return { slug, title: page.title, text };
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

function toContentDto(s: StoreSettings): StoreContentDto {
  return {
    tagline: s.tagline,
    heroTitle: s.heroTitle,
    heroSubtitle: s.heroSubtitle,
    announcementText: s.announcementText,
    termsText: s.termsText,
    privacyText: s.privacyText,
    returnsPolicyText: s.returnsPolicyText,
    shippingPolicyText: s.shippingPolicyText,
  };
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
