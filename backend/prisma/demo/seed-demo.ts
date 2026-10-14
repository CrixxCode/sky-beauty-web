/**
 * Carga datos de demostración evidentemente ficticios en la base de desarrollo para recorrer el
 * flujo completo: catálogo con fotos y variantes, inventario, promociones, testimonios y pedidos
 * en todos sus estados (por confirmar, confirmado, pago por verificar, pago rechazado, preparando,
 * despachado, entregado y cancelado), con ventas repartidas en los últimos 30 días.
 *
 * Todo se crea a través de la API del backend en ejecución (como lo haría la propietaria desde el
 * panel), así que quedan los historiales de precios, movimientos de inventario, eventos y pagos.
 * Solo las fechas se mueven hacia atrás directamente en la base, para que los reportes muestren
 * varios días. El backend debe estar corriendo con la misma base de datos (DEMO_API_URL, por
 * defecto http://localhost:<PORT>).
 *
 * No modifica la configuración de la tienda: los pedidos usan el primer método de pago activo
 * que no sea contra entrega.
 *
 * Uso (desde backend/): npm run db:demo   ·   Para borrarlo: npm run db:demo:clean
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { AdminRole, type PrismaClient } from '../../src/generated/prisma/client';
import { hashPassword } from '../../src/shared/security/password';
import {
  DEMO_ADMIN_EMAIL,
  DEMO_CARRIER,
  DEMO_PHONE_PREFIX,
  DEMO_PREFIX,
  demoPrisma,
} from './demo-common';

const API = '/api/v1';
const DAY = 86_400_000;

type Shape = 'lipstick' | 'gloss' | 'compact' | 'bottle' | 'palette' | 'pencil' | 'brush' | 'tube';

interface VariantSeed {
  name: string;
  colorHex?: string;
  price?: number;
  stock: number;
  lowStockThreshold?: number;
}

interface ProductSeed {
  name: string;
  brand: string;
  category: string;
  price: number;
  shape: Shape;
  netContent?: string;
  featured?: boolean;
  /** Fotos propias por variante (swatch del tono). */
  variantPhotos?: boolean;
  variants: VariantSeed[];
}

// ─────────────────────────────── Catálogo ficticio ───────────────────────────────

const BRANDS = ['Demo Aurora', 'Demo Bruma', 'Demo Cielo', 'Demo Dalia'];

/** Categorías principales con sus subcategorías (vacío: sin subcategorías). */
const CATEGORIES: Record<string, string[]> = {
  'Demo Rostro': ['Demo Bases', 'Demo Rubores'],
  'Demo Labios': [],
  'Demo Ojos': [],
  'Demo Skincare': [],
  'Demo Brochas': [],
};

const PRODUCTS: ProductSeed[] = [
  {
    name: 'Labial mate Demo',
    brand: 'Demo Aurora',
    category: 'Demo Labios',
    price: 32000,
    shape: 'lipstick',
    netContent: '3,5 g',
    featured: true,
    variantPhotos: true,
    variants: [
      { name: 'Tono Demo Rosa', colorHex: '#C9748A', stock: 18 },
      { name: 'Tono Demo Nude', colorHex: '#C89A86', stock: 14 },
      { name: 'Tono Demo Vino', colorHex: '#7B2F45', stock: 9 },
      { name: 'Tono Demo Coral', colorHex: '#E07A6A', stock: 2, lowStockThreshold: 3 },
      // Sin existencias: la tienda la muestra como agotada.
      { name: 'Tono Demo Ciruela', colorHex: '#5E2A4A', stock: 0 },
    ],
  },
  {
    name: 'Brillo labial Demo',
    brand: 'Demo Bruma',
    category: 'Demo Labios',
    price: 24000,
    shape: 'gloss',
    netContent: '6 ml',
    variants: [
      { name: 'Tono Demo Cristal', colorHex: '#F2D6DC', stock: 20 },
      { name: 'Tono Demo Durazno', colorHex: '#F0A98C', stock: 12 },
      { name: 'Tono Demo Frambuesa', colorHex: '#B8456A', stock: 10 },
    ],
  },
  {
    name: 'Delineador de labios Demo',
    brand: 'Demo Aurora',
    category: 'Demo Labios',
    price: 18000,
    shape: 'pencil',
    variants: [{ name: 'Tono Demo Natural', colorHex: '#A8665E', stock: 25 }],
  },
  {
    name: 'Bálsamo labial Demo',
    brand: 'Demo Dalia',
    category: 'Demo Labios',
    price: 15000,
    shape: 'tube',
    netContent: '4 g',
    variants: [{ name: 'Única', stock: 30 }],
  },
  {
    name: 'Base líquida Demo',
    brand: 'Demo Cielo',
    category: 'Demo Bases',
    price: 58000,
    shape: 'bottle',
    netContent: '30 ml',
    featured: true,
    variants: [
      { name: 'Tono Demo 01 Claro', colorHex: '#F1D3BC', stock: 10 },
      { name: 'Tono Demo 02 Medio', colorHex: '#D9A982', stock: 12 },
      { name: 'Tono Demo 03 Canela', colorHex: '#B57F57', stock: 8 },
      { name: 'Tono Demo 04 Profundo', colorHex: '#7E5236', stock: 6 },
    ],
  },
  {
    name: 'Corrector Demo',
    brand: 'Demo Cielo',
    category: 'Demo Bases',
    price: 36000,
    shape: 'tube',
    netContent: '7 ml',
    variants: [
      { name: 'Tono Demo Claro', colorHex: '#F3D9C4', stock: 15 },
      { name: 'Tono Demo Medio', colorHex: '#D7A888', stock: 15 },
      { name: 'Tono Demo Oscuro', colorHex: '#9C6B4B', stock: 9 },
    ],
  },
  {
    name: 'Rubor compacto Demo',
    brand: 'Demo Bruma',
    category: 'Demo Rubores',
    price: 34000,
    shape: 'compact',
    netContent: '5 g',
    variants: [
      { name: 'Tono Demo Pétalo', colorHex: '#E8A0A8', stock: 12 },
      { name: 'Tono Demo Melocotón', colorHex: '#EFA383', stock: 11 },
      { name: 'Tono Demo Malva', colorHex: '#B77C99', stock: 7 },
    ],
  },
  {
    name: 'Iluminador Demo',
    brand: 'Demo Dalia',
    category: 'Demo Rubores',
    price: 39000,
    shape: 'compact',
    // Sin existencias: todo el producto aparece como "Agotado".
    variants: [{ name: 'Tono Demo Champaña', colorHex: '#EAD3B0', stock: 0 }],
  },
  {
    name: 'Paleta de sombras Demo',
    brand: 'Demo Aurora',
    category: 'Demo Ojos',
    price: 89000,
    shape: 'palette',
    netContent: '12 x 1,2 g',
    featured: true,
    variants: [{ name: 'Única', stock: 9 }],
  },
  {
    name: 'Pestañina Demo',
    brand: 'Demo Bruma',
    category: 'Demo Ojos',
    price: 42000,
    shape: 'tube',
    netContent: '10 ml',
    variants: [{ name: 'Negro', colorHex: '#1F1A1C', stock: 22 }],
  },
  {
    name: 'Delineador de ojos Demo',
    brand: 'Demo Dalia',
    category: 'Demo Ojos',
    price: 28000,
    shape: 'pencil',
    variants: [
      { name: 'Negro', colorHex: '#1F1A1C', stock: 16 },
      { name: 'Café', colorHex: '#5A3A2B', stock: 10 },
    ],
  },
  {
    name: 'Sérum hidratante Demo',
    brand: 'Demo Cielo',
    category: 'Demo Skincare',
    price: 64000,
    shape: 'bottle',
    featured: true,
    variants: [
      { name: '30 ml', stock: 14 },
      { name: '50 ml', price: 92000, stock: 8 },
    ],
  },
  {
    name: 'Crema facial Demo',
    brand: 'Demo Dalia',
    category: 'Demo Skincare',
    price: 55000,
    shape: 'tube',
    netContent: '50 g',
    variants: [{ name: 'Única', stock: 13 }],
  },
  {
    name: 'Protector solar Demo',
    brand: 'Demo Cielo',
    category: 'Demo Skincare',
    price: 48000,
    shape: 'bottle',
    netContent: '50 ml',
    variants: [{ name: 'Única', stock: 3, lowStockThreshold: 5 }],
  },
  {
    name: 'Set de brochas Demo',
    brand: 'Demo Aurora',
    category: 'Demo Brochas',
    price: 75000,
    shape: 'brush',
    netContent: '8 piezas',
    variants: [{ name: 'Única', stock: 7 }],
  },
  {
    name: 'Brocha para base Demo',
    brand: 'Demo Bruma',
    category: 'Demo Brochas',
    price: 26000,
    shape: 'brush',
    variants: [{ name: 'Única', stock: 18 }],
  },
];

// ─────────────────────────────── Fotos ficticias ───────────────────────────────

/** Ilustración de producto (SVG → PNG) con la palabra DEMO, en los colores de la marca. */
function productSvg(shape: Shape, color: string, index: number): string {
  const backgrounds = [
    ['#F6EEF2', '#E8D3E3'],
    ['#F5F1EB', '#E6D9CC'],
    ['#F3ECF4', '#DCC6DD'],
    ['#FAF3EF', '#EBD5CF'],
  ];
  const [from, to] = backgrounds[index % backgrounds.length];
  const shapes: Record<Shape, string> = {
    lipstick: `<rect x="350" y="430" width="100" height="230" rx="10" fill="#3A2C36"/><rect x="362" y="350" width="76" height="90" rx="6" fill="#C9A86A"/><path d="M372 350 L372 250 Q400 215 428 270 L428 350 Z" fill="${color}"/>`,
    gloss: `<rect x="355" y="300" width="90" height="330" rx="40" fill="${color}" opacity=".85"/><rect x="370" y="210" width="60" height="100" rx="12" fill="#3A2C36"/>`,
    compact: `<circle cx="400" cy="420" r="210" fill="#3A2C36"/><circle cx="400" cy="420" r="160" fill="${color}"/><circle cx="350" cy="370" r="40" fill="#fff" opacity=".25"/>`,
    bottle: `<rect x="300" y="330" width="200" height="300" rx="34" fill="${color}" opacity=".9"/><rect x="365" y="250" width="70" height="90" rx="10" fill="#3A2C36"/><rect x="330" y="420" width="140" height="80" rx="8" fill="#fff" opacity=".55"/>`,
    palette: `<rect x="170" y="250" width="460" height="320" rx="24" fill="#3A2C36"/>${[
      0, 1, 2, 3, 4, 5,
    ]
      .map((n) => {
        const tones = ['#E8C3B5', '#C98F7E', '#8E5B6B', '#D9A3B6', '#B07A55', '#5E3E4F'];
        return `<circle cx="${250 + (n % 3) * 150}" cy="${340 + Math.floor(n / 3) * 140}" r="52" fill="${tones[n]}"/>`;
      })
      .join('')}`,
    pencil: `<rect x="230" y="385" width="320" height="40" rx="8" fill="#3A2C36" transform="rotate(-35 400 400)"/><path d="M550 385 L620 405 L550 425 Z" fill="${color}" transform="rotate(-35 400 400)"/>`,
    brush: `<rect x="240" y="388" width="260" height="26" rx="13" fill="#3A2C36" transform="rotate(-30 400 400)"/><rect x="490" y="380" width="60" height="42" rx="6" fill="#C9A86A" transform="rotate(-30 400 400)"/><path d="M545 372 Q640 360 650 400 Q640 440 545 430 Z" fill="#E9D9CF" transform="rotate(-30 400 400)"/>`,
    tube: `<path d="M330 260 L470 260 L450 600 L350 600 Z" fill="${color}" opacity=".9"/><rect x="345" y="600" width="110" height="60" rx="8" fill="#3A2C36"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <ellipse cx="400" cy="690" rx="230" ry="26" fill="#3A2C36" opacity=".08"/>
  ${shapes[shape]}
  <text x="400" y="760" font-family="sans-serif" font-size="30" letter-spacing="10" text-anchor="middle" fill="#70436F" opacity=".7">DEMO</text>
</svg>`;
}

/** Muestra de color (swatch) de una variante. */
function swatchSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <rect width="800" height="800" fill="#F7F1F3"/>
  <path d="M180 470 Q260 300 420 330 Q600 360 620 470 Q560 560 400 560 Q240 560 180 470 Z" fill="${color}"/>
  <text x="400" y="740" font-family="sans-serif" font-size="30" letter-spacing="10" text-anchor="middle" fill="#70436F" opacity=".7">DEMO</text>
</svg>`;
}

const png = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();

// ─────────────────────────────── Ayudas ───────────────────────────────

type Body = Record<string, unknown>;

/**
 * Cliente de la API con la sesión del panel: guarda la cookie del inicio de sesión y envía la
 * clave interna, que evita el límite de peticiones por IP durante la carga.
 */
class ApiClient {
  private cookie = '';

  constructor(
    private readonly baseUrl: string,
    private readonly internalKey?: string,
  ) {}

  async send(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    what: string,
    body?: Body | FormData,
  ): Promise<Body> {
    const headers: Record<string, string> = {};
    if (this.internalKey) headers['x-internal-api-key'] = this.internalKey;
    if (this.cookie) headers.cookie = this.cookie;
    let payload: string | FormData | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${this.baseUrl}${API}${path}`, { method, headers, body: payload });
    const cookies = res.headers.getSetCookie();
    if (cookies.length > 0) this.cookie = cookies.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${text}`);
    return (text ? JSON.parse(text) : {}) as Body;
  }

  post = (path: string, body: Body, what: string) => this.send('POST', path, what, body);
  patch = (path: string, body: Body, what: string) => this.send('PATCH', path, what, body);
  get = (path: string, what: string) => this.send('GET', path, what);

  /** Sube una foto PNG a un producto (opcionalmente de una variante). */
  async upload(
    productId: string,
    file: Buffer,
    filename: string,
    what: string,
    variantId?: string,
  ) {
    const form = new FormData();
    if (variantId) form.append('variantId', variantId);
    form.append('file', new Blob([new Uint8Array(file)], { type: 'image/png' }), filename);
    return this.send('POST', `/admin/products/${productId}/images`, what, form);
  }
}

const idOf = (body: Body) => body.id as string;

/** Mueve hacia atrás todas las fechas de un pedido (y lo relacionado) `days` días. */
async function shiftOrder(prisma: PrismaClient, orderId: string, days: number): Promise<void> {
  if (days <= 0) return;
  await prisma.$executeRaw`UPDATE "Order" SET
    "createdAt" = "createdAt" - make_interval(days => ${days}),
    "updatedAt" = "updatedAt" - make_interval(days => ${days}),
    "termsAcceptedAt" = "termsAcceptedAt" - make_interval(days => ${days}),
    "dataProcessingConsentAt" = "dataProcessingConsentAt" - make_interval(days => ${days}),
    "confirmedAt" = "confirmedAt" - make_interval(days => ${days}),
    "paymentRejectedAt" = "paymentRejectedAt" - make_interval(days => ${days}),
    "paidAt" = "paidAt" - make_interval(days => ${days}),
    "cancelledAt" = "cancelledAt" - make_interval(days => ${days})
    WHERE "id" = ${orderId}::uuid`;
  await prisma.$executeRaw`UPDATE "OrderStatusHistory" SET "createdAt" = "createdAt" - make_interval(days => ${days}) WHERE "orderId" = ${orderId}::uuid`;
  await prisma.$executeRaw`UPDATE "PaymentRecord" SET "createdAt" = "createdAt" - make_interval(days => ${days}) WHERE "orderId" = ${orderId}::uuid`;
  await prisma.$executeRaw`UPDATE "InventoryMovement" SET "createdAt" = "createdAt" - make_interval(days => ${days}) WHERE "orderId" = ${orderId}::uuid`;
  await prisma.$executeRaw`UPDATE "Shipping" SET
    "createdAt" = "createdAt" - make_interval(days => ${days}),
    "updatedAt" = "updatedAt" - make_interval(days => ${days}),
    "dispatchedAt" = "dispatchedAt" - make_interval(days => ${days}),
    "deliveredAt" = "deliveredAt" - make_interval(days => ${days})
    WHERE "orderId" = ${orderId}::uuid`;
}

// ─────────────────────────────── Pedidos ───────────────────────────────

type Stage =
  | 'PENDING'
  | 'CONFIRMED'
  | 'AWAITING_VERIFICATION'
  | 'PAYMENT_REJECTED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

interface OrderSeed {
  stage: Stage;
  /** Días hacia atrás (solo pedidos que ya terminaron, para no activar las cancelaciones). */
  daysAgo: number;
  municipalityCode: string;
  items: Array<{ product: string; variant?: number; quantity: number }>;
}

/** Riohacha (tarifa local configurada) y otras ciudades con envío por cotizar. */
const RIOHACHA = '44001';
const ORDERS: OrderSeed[] = [
  {
    stage: 'DELIVERED',
    daysAgo: 27,
    municipalityCode: RIOHACHA,
    items: [{ product: 'Labial mate Demo', variant: 0, quantity: 2 }],
  },
  {
    stage: 'DELIVERED',
    daysAgo: 24,
    municipalityCode: '11001',
    items: [
      { product: 'Base líquida Demo', variant: 1, quantity: 1 },
      { product: 'Corrector Demo', variant: 1, quantity: 1 },
    ],
  },
  {
    stage: 'DELIVERED',
    daysAgo: 21,
    municipalityCode: '05001',
    items: [{ product: 'Paleta de sombras Demo', quantity: 1 }],
  },
  {
    stage: 'DELIVERED',
    daysAgo: 18,
    municipalityCode: RIOHACHA,
    items: [
      { product: 'Sérum hidratante Demo', variant: 0, quantity: 1 },
      { product: 'Crema facial Demo', quantity: 1 },
    ],
  },
  {
    stage: 'DELIVERED',
    daysAgo: 14,
    municipalityCode: '08001',
    items: [
      { product: 'Rubor compacto Demo', variant: 0, quantity: 1 },
      { product: 'Brocha para base Demo', quantity: 1 },
    ],
  },
  {
    stage: 'DELIVERED',
    daysAgo: 11,
    municipalityCode: RIOHACHA,
    items: [
      { product: 'Labial mate Demo', variant: 2, quantity: 1 },
      { product: 'Brillo labial Demo', variant: 1, quantity: 2 },
    ],
  },
  {
    stage: 'DELIVERED',
    daysAgo: 8,
    municipalityCode: '76001',
    items: [{ product: 'Set de brochas Demo', quantity: 1 }],
  },
  {
    stage: 'DELIVERED',
    daysAgo: 5,
    municipalityCode: RIOHACHA,
    items: [
      { product: 'Pestañina Demo', quantity: 2 },
      { product: 'Delineador de ojos Demo', variant: 0, quantity: 1 },
    ],
  },
  {
    stage: 'SHIPPED',
    daysAgo: 2,
    municipalityCode: '11001',
    items: [{ product: 'Sérum hidratante Demo', variant: 1, quantity: 1 }],
  },
  {
    stage: 'PREPARING',
    daysAgo: 1,
    municipalityCode: RIOHACHA,
    items: [
      { product: 'Labial mate Demo', variant: 1, quantity: 1 },
      { product: 'Bálsamo labial Demo', quantity: 2 },
    ],
  },
  {
    stage: 'AWAITING_VERIFICATION',
    daysAgo: 0,
    municipalityCode: '05001',
    items: [{ product: 'Base líquida Demo', variant: 0, quantity: 1 }],
  },
  {
    stage: 'PAYMENT_REJECTED',
    daysAgo: 0,
    municipalityCode: RIOHACHA,
    items: [{ product: 'Brillo labial Demo', variant: 2, quantity: 1 }],
  },
  {
    stage: 'CONFIRMED',
    daysAgo: 0,
    municipalityCode: '08001',
    items: [{ product: 'Protector solar Demo', quantity: 1 }],
  },
  {
    stage: 'PENDING',
    daysAgo: 0,
    municipalityCode: '11001',
    items: [
      { product: 'Rubor compacto Demo', variant: 2, quantity: 1 },
      { product: 'Delineador de labios Demo', quantity: 1 },
    ],
  },
  {
    stage: 'CANCELLED',
    daysAgo: 3,
    municipalityCode: '76001',
    items: [{ product: 'Corrector Demo', variant: 0, quantity: 1 }],
  },
];

/** Costo de envío cotizado a mano por la tienda (ciudades sin tarifa configurada). */
const QUOTED_SHIPPING: Record<string, number> = {
  '11001': 14000,
  '05001': 13000,
  '08001': 12000,
  '76001': 13500,
};

// ─────────────────────────────── Programa ───────────────────────────────

async function main(): Promise<void> {
  const prisma = demoPrisma();
  if (await prisma.product.count({ where: { isDemo: true } })) {
    throw new Error('Ya hay datos de demostración. Bórralos primero con: npm run db:demo:clean');
  }

  // Cuenta del panel solo para este script, con una contraseña aleatoria que no se guarda.
  const password = randomBytes(18).toString('base64url');
  await prisma.adminUser.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    create: {
      email: DEMO_ADMIN_EMAIL,
      name: 'Demo (script)',
      role: AdminRole.ADMIN,
      passwordHash: await hashPassword(password),
    },
    update: {
      isActive: true,
      passwordHash: await hashPassword(password),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const baseUrl = process.env.DEMO_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  const api = new ApiClient(baseUrl.replace(/\/$/, ''), process.env.INTERNAL_API_KEY);
  const { post, patch, get } = api;

  try {
    await fetch(`${baseUrl}${API}/health`).catch(() => {
      throw new Error(`El backend no responde en ${baseUrl}. Inícialo (npm run start:dev).`);
    });
    await post('/admin/auth/login', { email: DEMO_ADMIN_EMAIL, password }, 'Inicio de sesión');

    // Marcas y categorías.
    const brandIds = new Map<string, string>();
    for (const name of BRANDS) {
      brandIds.set(name, idOf(await post('/admin/brands', { name }, `Marca ${name}`)));
    }
    const categoryIds = new Map<string, string>();
    for (const [parent, children] of Object.entries(CATEGORIES)) {
      const parentId = idOf(
        await post('/admin/categories', { name: parent }, `Categoría ${parent}`),
      );
      categoryIds.set(parent, parentId);
      for (const child of children) {
        categoryIds.set(
          child,
          idOf(await post('/admin/categories', { name: child, parentId }, `Categoría ${child}`)),
        );
      }
    }

    // Productos, variantes, fotos y existencias iniciales.
    const variantIds = new Map<string, string[]>();
    const productIds = new Map<string, string>();
    for (const [index, seed] of PRODUCTS.entries()) {
      const productId = idOf(
        await post(
          '/admin/products',
          {
            name: seed.name,
            shortDescription: 'Producto ficticio de demostración.',
            description:
              'Producto ficticio creado para recorrer la tienda de demostración. No está a la venta.',
            brandId: brandIds.get(seed.brand),
            categoryId: categoryIds.get(seed.category),
            basePrice: seed.price,
            netContent: seed.netContent,
            isFeatured: seed.featured ?? false,
          },
          `Producto ${seed.name}`,
        ),
      );
      productIds.set(seed.name, productId);

      const ids: string[] = [];
      for (const [v, variant] of seed.variants.entries()) {
        const price = variant.price ?? seed.price;
        const variantId = idOf(
          await post(
            `/admin/products/${productId}/variants`,
            {
              sku: `DEMO-${String(index + 1).padStart(2, '0')}-${v + 1}`,
              name: variant.name,
              colorHex: variant.colorHex,
              price: variant.price ?? null,
              // Costo de compra ficticio, para ver márgenes en los reportes.
              costPrice: Math.round((price * 0.45) / 100) * 100,
              lowStockThreshold: variant.lowStockThreshold ?? null,
            },
            `Variante ${variant.name}`,
          ),
        );
        ids.push(variantId);
        if (variant.stock > 0) {
          await post(
            '/admin/inventory/movements',
            { variantId, type: 'INITIAL', quantity: variant.stock },
            `Existencias de ${variant.name}`,
          );
        }
        if (seed.variantPhotos && variant.colorHex) {
          await api.upload(
            productId,
            await png(swatchSvg(variant.colorHex)),
            `demo-tono-${v + 1}.png`,
            `Foto del tono ${variant.name}`,
            variantId,
          );
        }
      }
      variantIds.set(seed.name, ids);

      const mainColor = seed.variants.find((variant) => variant.colorHex)?.colorHex ?? '#B785B8';
      await api.upload(
        productId,
        await png(productSvg(seed.shape, mainColor, index)),
        `demo-producto-${index + 1}.png`,
        `Foto de ${seed.name}`,
      );

      await patch(
        `/admin/products/${productId}/status`,
        { status: 'ACTIVE' },
        `Publicar ${seed.name}`,
      );
    }

    // Movimientos posteriores: una compra y un ajuste con su justificación.
    await post(
      '/admin/inventory/movements',
      {
        variantId: variantIds.get('Brillo labial Demo')![0],
        type: 'PURCHASE',
        quantity: 6,
        reason: 'Compra ficticia de demostración',
      },
      'Compra de inventario',
    );
    await post(
      '/admin/inventory/movements',
      {
        variantId: variantIds.get('Pestañina Demo')![0],
        type: 'ADJUSTMENT',
        quantity: -1,
        reason: 'Ajuste ficticio: unidad dañada en bodega',
      },
      'Ajuste de inventario',
    );

    // Promociones vigentes desde hace 30 días.
    const startsAt = new Date(Date.now() - 30 * DAY).toISOString();
    const endsAt = new Date(Date.now() + 30 * DAY).toISOString();
    await post(
      '/admin/promotions',
      {
        name: 'Demo 20 % labial mate',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        scope: 'PRODUCT',
        productIds: [productIds.get('Labial mate Demo')],
        startsAt,
        endsAt,
      },
      'Promoción de producto',
    );
    await post(
      '/admin/promotions',
      {
        name: 'Demo 15 % skincare',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        scope: 'CATEGORY',
        categoryIds: [categoryIds.get('Demo Skincare')],
        startsAt,
        endsAt,
      },
      'Promoción de categoría',
    );
    await post(
      '/admin/promotions',
      {
        name: 'Demo $10.000 set de brochas',
        discountType: 'FIXED_AMOUNT',
        discountValue: 10000,
        scope: 'PRODUCT',
        productIds: [productIds.get('Set de brochas Demo')],
        startsAt,
        endsAt,
      },
      'Promoción de valor fijo',
    );

    // Testimonios (opiniones ficticias, publicadas).
    const testimonials = [
      {
        firstName: 'Demo Ana',
        lastInitial: 'R',
        rating: 5,
        product: 'Labial mate Demo',
        comment: 'Comentario de demostración: el tono es igual al de la foto y llegó rápido.',
      },
      {
        firstName: 'Demo Laura',
        lastInitial: 'M',
        rating: 4,
        product: 'Base líquida Demo',
        comment: 'Comentario de demostración: me ayudaron por WhatsApp a elegir mi tono.',
      },
      {
        firstName: 'Demo Sofía',
        lastInitial: 'P',
        rating: 5,
        product: null,
        comment: 'Comentario de demostración: compra sencilla y sin crear cuenta.',
      },
    ];
    for (const t of testimonials) {
      await post(
        '/admin/testimonials',
        {
          firstName: t.firstName,
          lastInitial: t.lastInitial,
          rating: t.rating,
          comment: t.comment,
          productId: t.product ? productIds.get(t.product) : null,
          isPublished: true,
        },
        `Testimonio de ${t.firstName}`,
      );
    }

    // Transportadora para los despachos.
    const carrierId = idOf(
      await post(
        '/admin/carriers',
        { name: DEMO_CARRIER, trackingUrlTemplate: 'https://rastreo.ejemplo.test/guia/{tracking}' },
        'Transportadora',
      ),
    );

    // El catálogo existe desde hace 35 días (precios, existencias iniciales y versiones de las
    // promociones), así los pedidos con fecha anterior siguen siendo coherentes.
    await prisma.product.updateMany({
      where: { id: { in: [...productIds.values()] } },
      data: { isDemo: true },
    });
    const allVariantIds = [...variantIds.values()].flat();
    const productIdList = [...productIds.values()];
    await prisma.$executeRaw`UPDATE "VariantPriceHistory" SET "validFrom" = "validFrom" - make_interval(days => 35) WHERE "variantId" = ANY(${allVariantIds}::uuid[])`;
    await prisma.$executeRaw`UPDATE "InventoryMovement" SET "createdAt" = "createdAt" - make_interval(days => 35) WHERE "variantId" = ANY(${allVariantIds}::uuid[]) AND "type" = 'INITIAL'`;
    await prisma.$executeRaw`UPDATE "PromotionRevision" SET "validFrom" = "validFrom" - make_interval(days => 35) WHERE "promotionId" IN (SELECT "id" FROM "Promotion" WHERE "name" LIKE ${`${DEMO_PREFIX}%`})`;
    // Publicados en días distintos, para que "Recién llegados" tenga un orden.
    for (const [index, id] of productIdList.entries()) {
      await prisma.$executeRaw`UPDATE "Product" SET "publishedAt" = now() - make_interval(days => ${35 - index * 2}), "createdAt" = now() - make_interval(days => ${36 - index * 2}) WHERE "id" = ${id}::uuid`;
    }

    // Pedidos: el cliente compra en la tienda y la propietaria lo lleva hasta su estado.
    const methods = await prisma.paymentMethod.findMany({
      where: { isActive: true, code: { not: 'CASH_ON_DELIVERY' } },
      orderBy: { code: 'asc' },
    });
    if (methods.length === 0) {
      throw new Error(
        'No hay métodos de pago activos (transferencia, Nequi o Daviplata). Activa uno en Configuración.',
      );
    }
    const paymentMethodId = methods[0].id;
    const summary: string[] = [];

    for (const [n, seed] of ORDERS.entries()) {
      // Teléfono ficticio con el código de país (57300000XXXX).
      const phone = `${DEMO_PHONE_PREFIX}${String(n + 1).padStart(4, '0')}`;
      const created = await post(
        '/store/orders',
        {
          items: seed.items.map((item) => ({
            variantId: variantIds.get(item.product)![item.variant ?? 0],
            quantity: item.quantity,
          })),
          municipalityCode: seed.municipalityCode,
          customerName: `Clienta Demo ${String(n + 1).padStart(2, '0')}`,
          customerPhone: phone,
          addressLine: `Calle Demo # ${n + 1}-0${(n % 9) + 1}`,
          deliveryNotes: n % 3 === 0 ? 'Indicación ficticia de demostración.' : undefined,
          paymentMethodId,
          idempotencyKey: `demo-${Date.now()}-${n}`,
          termsAccepted: true,
          dataProcessingAccepted: true,
        },
        `Pedido ${n + 1}`,
      );
      const { id, code } = created as { id: string; code: string };
      const orders = `/admin/orders/${id}`;

      if (seed.stage !== 'PENDING') {
        const detail = (await get(orders, `Pedido ${code}`)) as {
          shippingCost: number | null;
        };
        if (seed.stage === 'CANCELLED') {
          await patch(
            `${orders}/cancel`,
            { reason: 'Cancelación ficticia: la clienta pidió cancelar por WhatsApp.' },
            `Cancelar ${code}`,
          );
        } else {
          await patch(
            `${orders}/confirm`,
            detail.shippingCost === null
              ? { shippingCost: QUOTED_SHIPPING[seed.municipalityCode] ?? 5000 }
              : {},
            `Confirmar ${code}`,
          );
        }
      }
      if (
        ['AWAITING_VERIFICATION', 'PAYMENT_REJECTED', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(
          seed.stage,
        )
      ) {
        await patch(
          `${orders}/payment-received`,
          { reference: `COMPROBANTE-DEMO-${n + 1}` },
          `Comprobante ${code}`,
        );
      }
      if (seed.stage === 'PAYMENT_REJECTED') {
        await patch(
          `${orders}/payment/reject`,
          { reason: 'Rechazo ficticio: el comprobante no coincide con el valor.' },
          `Rechazar pago ${code}`,
        );
      }
      if (['PREPARING', 'SHIPPED', 'DELIVERED'].includes(seed.stage)) {
        await patch(`${orders}/payment/verify`, {}, `Verificar pago ${code}`);
        await patch(
          `${orders}/status`,
          { status: 'PREPARING', note: 'Empacando (demostración).' },
          `Preparar ${code}`,
        );
      }
      if (['SHIPPED', 'DELIVERED'].includes(seed.stage)) {
        const local = seed.municipalityCode === RIOHACHA;
        await patch(
          `${orders}/shipping`,
          local
            ? { method: 'LOCAL', status: 'IN_TRANSIT' }
            : {
                method: 'CARRIER',
                status: 'IN_TRANSIT',
                carrierId,
                trackingNumber: `DEMO${String(100000 + n)}`,
                carrierCost: Math.round((QUOTED_SHIPPING[seed.municipalityCode] ?? 5000) * 0.8),
              },
          `Despachar ${code}`,
        );
      }
      if (seed.stage === 'DELIVERED') {
        await patch(`${orders}/shipping`, { status: 'DELIVERED' }, `Entregar ${code}`);
      }

      await shiftOrder(prisma, id, seed.daysAgo);
      summary.push(`${code} · ${seed.stage}${seed.daysAgo ? ` · hace ${seed.daysAgo} d` : ''}`);
    }

    console.log('\nDatos de demostración cargados:');
    console.log(
      `- ${BRANDS.length} marcas, ${categoryIds.size} categorías y ${PRODUCTS.length} productos con fotos`,
    );
    console.log('- 3 promociones, 3 testimonios y 1 transportadora');
    console.log(`- ${ORDERS.length} pedidos (método de pago: ${methods[0].name}):`);
    for (const line of summary) console.log(`  ${line}`);
    console.log('\nPara borrarlos: npm run db:demo:clean');
  } finally {
    // La cuenta del script queda desactivada: nadie puede entrar con ella.
    await prisma.adminUser.update({
      where: { email: DEMO_ADMIN_EMAIL },
      data: { isActive: false },
    });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
