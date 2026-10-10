import { ArrowLeft, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Eyebrow, serifClass, TextAction } from '@/components/ui/typography';
import { LoginForm } from '@/features/admin-auth/login-form';
import { getCurrentAdmin } from '@/features/admin-auth/session.server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Iniciar sesión' };

// Replica la pantalla de acceso del panel del prototipo (.admin-gate y .gate-panel).
export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect('/admin');

  return (
    <main className="grid min-h-screen place-items-center bg-gate-bg p-5">
      <div className="flex w-[min(100%,540px)] flex-col items-center bg-white px-11 py-13.25 text-center max-[600px]:px-5.75 max-[600px]:py-10">
        <ShieldAlert size={38} className="mb-5 text-[#9d759d]" />
        <Eyebrow>Acceso administrativo</Eyebrow>
        <h1
          className={cn(
            serifClass,
            'mb-4.5 mt-2 text-[41px] leading-normal max-[600px]:text-[35px]',
          )}
        >
          Panel de gestión Sky Beauty
        </h1>
        <p className="mb-6.25 text-[11px] leading-loose text-[#82747e]">
          Ingresa con tu cuenta del panel.
        </p>
        <div className="w-full text-left">
          <LoginForm />
        </div>
        <TextAction href="/" className="mt-5.5">
          <ArrowLeft size={16} /> Volver a la tienda
        </TextAction>
      </div>
    </main>
  );
}
