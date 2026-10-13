import { StoreTextPage, storePageMetadata } from '@/features/storefront/store-page';

export const generateMetadata = () => storePageMetadata('envios');

export default function Page() {
  return <StoreTextPage slug="envios" />;
}
