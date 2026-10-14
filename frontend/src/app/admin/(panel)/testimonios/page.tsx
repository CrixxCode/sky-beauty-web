import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { TestimonialsManager } from '@/features/content/testimonials-manager';

export const metadata: Metadata = { title: 'Testimonios' };

export default async function TestimoniosPage() {
  const admin = await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Testimonios"
        description={
          admin.role === 'ADMIN'
            ? 'Opiniones de clientas que se muestran en el inicio de la tienda.'
            : 'Opiniones de clientas que se muestran en la tienda. Solo la propietaria las modifica.'
        }
      />
      <TestimonialsManager canEdit={admin.role === 'ADMIN'} />
    </>
  );
}
