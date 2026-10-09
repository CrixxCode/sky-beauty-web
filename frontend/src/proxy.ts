import { NextResponse, type NextRequest } from 'next/server';

// Debe coincidir con SESSION_COOKIE (src/features/admin-auth/session.server.ts). El proxy no importa
// ese módulo porque se ejecuta aparte del código de renderizado.
const SESSION_COOKIE = 'sb_admin_session';

/**
 * Comprobación optimista: si no existe la cookie de sesión, redirige al inicio de sesión sin renderizar.
 * No valida la sesión; eso lo hacen las páginas (requireAdmin) y, sobre todo, el backend.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin/login') return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL('/admin/login', request.url));
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
