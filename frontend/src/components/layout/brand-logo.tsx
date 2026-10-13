import Image from 'next/image';

/** Logotipo oficial horizontal (replica .official-logo del prototipo). */
export function BrandLogo() {
  return (
    <Image
      src="/brand/horizontal_logo.svg"
      alt="Sky Beauty by Cielo Oviedo"
      width={180}
      height={41}
      priority
      className="block h-auto max-h-16 w-45 max-w-full object-contain"
    />
  );
}
