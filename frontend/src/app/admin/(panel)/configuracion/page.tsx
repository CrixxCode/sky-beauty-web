import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { PaymentMethodsPanel } from '@/features/store-settings/payment-methods';
import { StoreSettingsForms } from '@/features/store-settings/settings-forms';

export const metadata: Metadata = { title: 'Configuración' };

// Sección "Configuración" del panel del prototipo, con datos reales. El personal la consulta en
// modo solo lectura; solo la propietaria la modifica (Context/decisiones.md).
export default async function ConfiguracionPage() {
  const admin = await requireAdmin();
  const canEdit = admin.role === 'ADMIN';

  return (
    <>
      <AdminHeading
        title="Configuración"
        description={
          canEdit
            ? 'Datos de contacto, cifras comerciales y métodos de pago de la tienda.'
            : 'Consulta de la configuración. Solo la propietaria puede modificarla.'
        }
      />
      <div className="space-y-5">
        <StoreSettingsForms canEdit={canEdit} />
        <PaymentMethodsPanel canEdit={canEdit} />
      </div>
    </>
  );
}
