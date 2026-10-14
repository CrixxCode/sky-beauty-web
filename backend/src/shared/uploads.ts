/**
 * Ruta pública de los archivos subidos (fotos de productos). El frontend reenvía esta ruta al
 * backend (frontend/next.config.ts), así que las fotos se sirven desde el mismo dominio de la tienda
 * y el backend no necesita un dominio público propio.
 */
export const UPLOADS_PATH = '/uploads';

/**
 * Dirección pública de un archivo a partir de su clave (ruta relativa a UPLOADS_DIR). Se calcula al
 * responder, no se guarda: así un cambio de dominio no rompe las fotos ya subidas.
 */
export function uploadUrl(storageKey: string): string {
  return `${UPLOADS_PATH}/${storageKey}`;
}
