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
};

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
