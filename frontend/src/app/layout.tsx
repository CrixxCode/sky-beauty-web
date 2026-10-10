import type { Metadata } from 'next';
import { Playfair_Display, Poppins } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Tipografías oficiales (Context/decisiones.md).
const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Sky Beauty Maquillaje',
    template: '%s | Sky Beauty Maquillaje',
  },
  description: 'Tienda virtual de maquillaje y productos de belleza.',
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
