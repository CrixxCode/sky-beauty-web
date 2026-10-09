import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/admin-auth/login-form';
import { getCurrentAdmin } from '@/features/admin-auth/session.server';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect('/admin');

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <p className="text-lg font-semibold tracking-tight">Sky Beauty</p>
          <h1 className="text-sm text-muted-foreground">Panel administrativo</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
