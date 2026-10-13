/** Configuración de la tienda (GET /admin/settings). */
export interface StoreSettings {
  storeName: string;
  whatsappNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressText: string | null;
  businessHours: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  nationalFreeShipping: boolean;
  freeShippingThreshold: number | null;
  defaultLowStockThreshold: number | null;
  maxPercentageDiscount: number | null;
}

/** Datos públicos de la tienda (GET /store/info). */
export type PublicStoreInfo = Pick<
  StoreSettings,
  | 'storeName'
  | 'whatsappNumber'
  | 'contactEmail'
  | 'contactPhone'
  | 'addressText'
  | 'businessHours'
  | 'instagramUrl'
  | 'facebookUrl'
  | 'tiktokUrl'
> & {
  heroTitle: string | null;
  heroSubtitle: string | null;
  tagline: string | null;
  announcementText: string | null;
  /** Páginas de texto con contenido publicado (p. ej. "terminos"). */
  publishedPages: StorePageSlug[];
};

/** Páginas de texto de la tienda (módulo 12). */
export type StorePageSlug = 'terminos' | 'datos-personales' | 'cambios-y-garantias' | 'envios';

export const STORE_PAGE_LINKS: Array<{ slug: StorePageSlug; label: string }> = [
  { slug: 'terminos', label: 'Términos y condiciones' },
  { slug: 'datos-personales', label: 'Datos personales' },
  { slug: 'cambios-y-garantias', label: 'Cambios y garantías' },
  { slug: 'envios', label: 'Envíos' },
];

/** Contenido editable de la tienda (GET /admin/content). */
export interface StoreContent {
  tagline: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  announcementText: string | null;
  termsText: string | null;
  privacyText: string | null;
  returnsPolicyText: string | null;
  shippingPolicyText: string | null;
}

export interface PaymentMethodCity {
  municipalityCode: string;
  municipalityName: string;
  departmentName: string;
}

/** Método de pago (GET /admin/payment-methods). */
export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  instructions: string | null;
  requiresVerification: boolean;
  restrictToCities: boolean;
  maxOrderTotal: number | null;
  isActive: boolean;
  cities: PaymentMethodCity[];
}

/** Departamento o municipio de la DIVIPOLA (GET /store/locations/...). */
export interface Location {
  code: string;
  name: string;
}

export interface ShippingRate {
  id: string;
  municipalityCode: string;
  municipalityName: string;
  departmentName: string;
  amount: number;
}
