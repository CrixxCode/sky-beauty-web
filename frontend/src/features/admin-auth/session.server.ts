import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { internalApiHeaders } from '@/lib/api.server';
import type { AdminProfile, AdminRole } from '@/types/admin';

/** Debe coincidir con SESSION_COOKIE del backend (backend/src/modules/auth/auth.types.ts). */
export const SESSION_COOKIE = 'sb_admin_session';

/**
 * Usuario del panel de la petición actual, validado contra el backend, o null si no hay sesión válida.
 * Se memoriza durante una misma renderización. Solo se usa en el servidor.
 */
export const getCurrentAdmin = cache(async (): Promise<AdminProfile | null> => {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return null;

  const apiUrl = process.env.API_INTERNAL_URL;
  if (!apiUrl) throw new Error('API_INTERNAL_URL no está definida.');

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/admin/auth/me`, {
    headers: internalApiHeaders({ cookie: `${SESSION_COOKIE}=${session.value}` }),
    cache: 'no-store',
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`No se pudo validar la sesión (HTTP ${response.status}).`);
  return (await response.json()) as AdminProfile;
});

/** Exige una sesión válida del panel; si no la hay, redirige al inicio de sesión. */
export async function requireAdmin(): Promise<AdminProfile> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}

/** Exige un rol concreto; si el usuario no lo tiene, vuelve al inicio del panel. */
export async function requireRole(role: AdminRole): Promise<AdminProfile> {
  const admin = await requireAdmin();
  if (admin.role !== role) redirect('/admin');
  return admin;
}
