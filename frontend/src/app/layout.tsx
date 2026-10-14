import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Poppins } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Tipografías oficiales (Context/decisiones.md).
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

// Dirección pública del sitio: base de los enlaces canónicos y de la vista previa en redes.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Sky Beauty Maquillaje',
    template: '%s | Sky Beauty Maquillaje',
  },
  description: 'Tienda de maquillaje y productos de belleza en Riohacha, La Guajira, Colombia.',
  icons: { icon: { url: '/brand/favicon.svg', type: 'image/svg+xml' } },
};

// La identidad visual no define modo oscuro: la barra del navegador toma el fondo del sitio.
export const viewport: Viewport = {
  themeColor: '#fffcf9',
  colorScheme: 'light',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${poppins.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
