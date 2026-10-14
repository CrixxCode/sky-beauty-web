import { ArrowRight, AtSign, Clock, MapPin, MessageCircle, Phone, Share2 } from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { serifClass } from '@/components/ui/typography';
import { StorePageHeading } from '@/features/storefront/catalog-ui';
import { fetchPublicApi } from '@/lib/api.server';
import { whatsappUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicStoreInfo } from '@/types/store';

export const metadata: Metadata = { title: 'Contacto' };

/**
 * Contacto (replica .contact-page del prototipo). Muestra solo los datos configurados en el panel.
 * En lugar del formulario del prototipo (necesitaría un servicio de correo, que el proyecto no
 * usa), la atención es por WhatsApp.
 */
export default async function ContactoPage() {
  const info = await fetchPublicApi<PublicStoreInfo>('/store/info');
  const socials = [
    { label: 'Instagram', url: info?.instagramUrl },
    { label: 'Facebook', url: info?.facebookUrl },
    { label: 'TikTok', url: info?.tiktokUrl },
  ].filter((s): s is { label: string; url: string } => Boolean(s.url));
  const hasDetails = Boolean(
    info?.contactPhone ||
      info?.contactEmail ||
      info?.addressText ||
      info?.businessHours ||
      socials.length,
  );

  return (
    <Container className="min-h-[60vh] py-11.25">
      <StorePageHeading eyebrow="Atención" title="Contacto" />
      <div className="grid grid-cols-2 gap-23.75 max-[850px]:gap-9 max-[600px]:grid-cols-1 max-[600px]:gap-10.5">
        <div>
          {info?.contactPhone && (
            <ContactPoint icon={<Phone />} label="Teléfono">
              <a href={`tel:${info.contactPhone.replace(/\s+/g, '')}`}>{info.contactPhone}</a>
            </ContactPoint>
          )}
          {info?.contactEmail && (
            <ContactPoint icon={<AtSign />} label="Correo">
              <a href={`mailto:${info.contactEmail}`}>{info.contactEmail}</a>
            </ContactPoint>
          )}
          {info?.addressText && (
            <ContactPoint icon={<MapPin />} label="Dirección">
              {info.addressText}
            </ContactPoint>
          )}
          {info?.businessHours && (
            <ContactPoint icon={<Clock />} label="Horario de atención">
              {info.businessHours}
            </ContactPoint>
          )}
          {socials.length > 0 && (
            <ContactPoint icon={<Share2 />} label="Redes sociales">
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {socials.map((s) => (
                  <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                ))}
              </span>
            </ContactPoint>
          )}
          {!hasDetails && (
            <p className="text-xs text-[#72646a]">
              Los datos de contacto aún no están disponibles.
            </p>
          )}
        </div>
        <div className="bg-[#f8f2f5] p-10 max-[850px]:p-6.75">
          <MessageCircle size={30} className="mb-4 text-[#7f5d7d]" />
          <h2 className={cn(serifClass, 'mb-3 text-[29px] leading-tight')}>WhatsApp</h2>
          {info?.whatsappNumber ? (
            <Button asChild className="mt-2">
              <a href={whatsappUrl(info.whatsappNumber)} target="_blank" rel="noopener noreferrer">
                Escríbenos por WhatsApp <ArrowRight size={16} />
              </a>
            </Button>
          ) : (
            <p className="text-xs text-[#72646a]">El número de WhatsApp aún no está disponible.</p>
          )}
        </div>
      </div>
    </Container>
  );
}

function ContactPoint({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4.25 border-b border-[#ede4e8] py-4.5 text-[#7f5d7d]">
      <span className="mt-0.5 shrink-0 [&>svg]:size-5">{icon}</span>
      <span className="min-w-0 text-xs">
        <strong className="block font-semibold text-[#3f333c]">{label}</strong>
        <span className="mt-1 block wrap-break-word text-[#6f606a] [&_a]:underline-offset-4 [&_a]:hover:text-[#7a5178] [&_a]:hover:underline">
          {children}
        </span>
      </span>
    </div>
  );
}
