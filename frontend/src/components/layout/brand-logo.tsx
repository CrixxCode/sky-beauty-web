/**
 * Espacio reservado para el logotipo oficial (replica .logo-reserved del prototipo).
 * El logotipo no se recrea: se reemplaza por el archivo oficial cuando esté disponible.
 */
export function BrandLogo() {
  return (
    <div
      role="img"
      aria-label="Sky Beauty: logotipo oficial pendiente de incorporar"
      className="flex h-14.25 w-42.5 min-w-37.5 flex-col items-center justify-center gap-0.75 border border-dashed border-[#d6c7d3] bg-[#fbf6f8] text-center text-[#695c64] max-[600px]:h-11.75 max-[600px]:w-31.25 max-[600px]:min-w-0"
    >
      <span className="text-[10px] font-semibold tracking-[.17em] max-[600px]:text-[9px]">
        LOGOTIPO ORIGINAL
      </span>
      <small className="text-[8px] text-[#977c93] max-[600px]:text-[7px]">
        Archivo oficial pendiente
      </small>
    </div>
  );
}
