import { StoreTextPage, storePageMetadata } from '@/features/storefront/store-page';

export const generateMetadata = () => storePageMetadata('datos-personales');

export default function Page() {
  return <StoreTextPage slug="datos-personales" />;
}
