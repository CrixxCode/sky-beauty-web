import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { serifClass } from '@/components/ui/typography';
import { whatsappUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicStoreInfo } from '@/types/store';

const heading = 'mb-5 text-xs font-semibold text-white';
const linkClass = 'mb-3 block text-[11px] text-[#e2cfdf] hover:text-white';

/**
 * Pie de la tienda (replica .site-footer y .footer-grid del prototipo).
 * Solo muestra los datos de contacto y redes configurados; los textos comerciales del pie se
 * definen en el módulo de contenido.
 */
export function StoreFooter({ info }: { info: PublicStoreInfo | null }) {
  const contactLines = [
    info?.contactPhone,
    info?.contactEmail,
    info?.addressText,
    info?.businessHours,
  ].filter((v): v is string => Boolean(v));
  const socials = [
    { label: 'Instagram', url: info?.instagramUrl },
    { label: 'Facebook', url: info?.facebookUrl },
    { label: 'TikTok', url: info?.tiktokUrl },
  ].filter((s): s is { label: string; url: string } => Boolean(s.url));

  return (
    <footer className="bg-[#594052] pt-16.75 text-[#f7edf2] max-[600px]:pt-12">
      <Container className="grid gap-6.25 min-[601px]:grid-cols-[2fr_1fr_1fr] min-[851px]:grid-cols-[2.1fr_1fr_1fr_1.5fr] min-[851px]:gap-13.75 max-[600px]:grid-cols-2 max-[600px]:gap-x-4.25 max-[600px]:gap-y-8">
        <div className="col-span-full min-[851px]:col-span-1">
          <h2 className={cn(serifClass, 'mb-4.75 mt-0.75 text-[39px] text-white')}>
            {info?.storeName ?? 'Sky Beauty'}
          </h2>
        </div>
        {contactLines.length > 0 && (
          <div>
            <h3 className={heading}>Contacto</h3>
            {contactLines.map((line) => (
              <p key={line} className="mb-3 text-[11px] leading-relaxed text-[#e2cfdf]">
                {line}
              </p>
            ))}
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
          <div className="col-span-full min-[851px]:col-span-1">
            <h3 className={heading}>Atención por WhatsApp</h3>
            <a
              href={whatsappUrl(info.whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3.5 inline-flex items-center gap-2 text-[11px] text-white"
            >
              Escríbenos por WhatsApp <ArrowRight size={15} />
            </a>
          </div>
        )}
      </Container>
      <Container className="mt-15.5 flex justify-between gap-4 border-t border-[#826b7f] py-5.25 text-[10px] text-[#e6d6e1] max-[600px]:mt-8.75 max-[600px]:flex-col max-[600px]:text-[9px]">
        <span>
          © {new Date().getFullYear()} {info?.storeName ?? 'Sky Beauty Maquillaje'}
        </span>
        <span>Colombia</span>
      </Container>
    </footer>
  );
}
