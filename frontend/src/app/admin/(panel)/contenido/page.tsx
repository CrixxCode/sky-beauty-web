import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { ContentForm } from '@/features/content/content-form';

export const metadata: Metadata = { title: 'Contenido' };

// El personal consulta el contenido; solo la propietaria lo modifica, como la configuración.
export default async function ContenidoPage() {
  const admin = await requireAdmin();
  const canEdit = admin.role === 'ADMIN';

  return (
    <>
      <AdminHeading
        title="Contenido"
        description="Textos del inicio, barra de anuncio, descripción para buscadores y páginas legales de la tienda."
      />
      <ContentForm canEdit={canEdit} />
    </>
  );
}
