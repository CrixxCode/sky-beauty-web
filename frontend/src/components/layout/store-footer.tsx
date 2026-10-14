import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { serifClass } from '@/components/ui/typography';
import { whatsappUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import { STORE_PAGE_LINKS, type PublicStoreInfo } from '@/types/store';

const heading = 'mb-5 text-xs font-semibold text-white';
const linkClass = 'mb-3 block py-0.5 text-xs text-[#e2cfdf] hover:text-white hover:underline';

// Envíos y cambios van con el servicio al cliente; términos y datos personales, con lo legal.
const serviceSlugs = new Set(['envios', 'cambios-y-garantias']);
const serviceLinks = STORE_PAGE_LINKS.filter((page) => serviceSlugs.has(page.slug));
const legalLinks = STORE_PAGE_LINKS.filter((page) => !serviceSlugs.has(page.slug));

/**
 * Pie de la tienda (replica .site-footer y .footer-grid del prototipo).
 * Solo muestra los datos de contacto y redes configurados; los textos comerciales del pie se
 * definen en el módulo de contenido.
 */
export function StoreFooter({ info }: { info: PublicStoreInfo | null }) {
  // El teléfono y el correo se pueden tocar para llamar o escribir; el resto es texto.
  const contactLines = [
    info?.contactPhone && {
      text: info.contactPhone,
      href: `tel:${info.contactPhone.replace(/\s+/g, '')}`,
    },
    info?.contactEmail && { text: info.contactEmail, href: `mailto:${info.contactEmail}` },
    info?.addressText && { text: info.addressText },
    info?.businessHours && { text: info.businessHours },
  ].filter((line): line is { text: string; href?: string } => Boolean(line));
  const socials = [
    { label: 'Instagram', url: info?.instagramUrl },
    { label: 'Facebook', url: info?.facebookUrl },
    { label: 'TikTok', url: info?.tiktokUrl },
  ].filter((s): s is { label: string; url: string } => Boolean(s.url));

  return (
    <footer className="bg-[#594052] pt-16.75 text-[#f7edf2] max-[600px]:pt-12">
      {/* En escritorio ancho, la marca y luego una columna por sección: las de contacto, redes y
          WhatsApp solo aparecen si están configuradas, así que las columnas se reparten solas.
          En tableta y escritorio angosto, tres columnas bajo la marca. */}
      <Container className="grid gap-6.25 min-[601px]:grid-cols-3 min-[601px]:gap-x-8 min-[601px]:gap-y-10 min-[1151px]:auto-cols-fr min-[1151px]:grid-flow-col min-[1151px]:grid-cols-[1.6fr] min-[1151px]:gap-10 max-[600px]:grid-cols-2 max-[600px]:gap-x-4.25 max-[600px]:gap-y-8">
        <div className="col-span-full min-[1151px]:col-span-1">
          <h2 className={cn(serifClass, 'mb-4.75 mt-0.75 text-[39px] text-white')}>
            {info?.storeName ?? 'Sky Beauty'}
          </h2>
        </div>
        <nav aria-label="Tienda">
          <h3 className={heading}>Tienda</h3>
          <Link href="/productos" className={linkClass}>
            Todos los productos
          </Link>
          <Link href="/productos?ofertas=1" className={linkClass}>
            Ofertas
          </Link>
          <Link href="/favoritos" className={linkClass}>
            Favoritos
          </Link>
          <Link href="/contacto" className={linkClass}>
            Contacto
          </Link>
        </nav>
        {/* Las páginas sin texto publicado avisan que la información estará disponible pronto. */}
        <nav aria-label="Servicio al cliente">
          <h3 className={heading}>Servicio al cliente</h3>
          <Link href="/rastrear" className={linkClass}>
            Rastrear pedido
          </Link>
          {serviceLinks.map((page) => (
            <Link key={page.slug} href={`/${page.slug}`} className={linkClass}>
              {page.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Información legal">
          <h3 className={heading}>Información legal</h3>
          {legalLinks.map((page) => (
            <Link key={page.slug} href={`/${page.slug}`} className={linkClass}>
              {page.label}
            </Link>
          ))}
        </nav>
        {contactLines.length > 0 && (
          <div>
            <h3 className={heading}>Contacto</h3>
            {contactLines.map((line) =>
              line.href ? (
                <a key={line.text} href={line.href} className={cn(linkClass, 'wrap-break-word')}>
                  {line.text}
                </a>
              ) : (
                <p
                  key={line.text}
                  className="mb-3 wrap-break-word text-xs leading-relaxed text-[#e2cfdf]"
                >
                  {line.text}
                </p>
              ),
            )}
          </div>
        )}
        {socials.length > 0 && (
          <div>
            <h3 className={heading}>Síguenos</h3>
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {s.label}
              </a>
            ))}
          </div>
        )}
        {info?.whatsappNumber && (
          <div className="col-span-full min-[1151px]:col-span-1">
            <h3 className={heading}>Atención por WhatsApp</h3>
            <a
              href={whatsappUrl(info.whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3.5 inline-flex min-h-11 items-center gap-2 text-xs text-white hover:underline"
            >
              Escríbenos por WhatsApp <ArrowRight size={15} />
            </a>
          </div>
        )}
      </Container>
      <Container className="mt-15.5 flex justify-between gap-4 border-t border-[#826b7f] py-5.25 text-xs text-[#e6d6e1] max-[600px]:mt-8.75 max-[600px]:flex-col">
        <span>
          © {new Date().getFullYear()} {info?.storeName ?? 'Sky Beauty Maquillaje'}
        </span>
        <span>Colombia</span>
      </Container>
    </footer>
  );
}
