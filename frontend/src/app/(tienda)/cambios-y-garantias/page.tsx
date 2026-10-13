import { StoreTextPage, storePageMetadata } from '@/features/storefront/store-page';

export const generateMetadata = () => storePageMetadata('cambios-y-garantias');

export default function Page() {
  return <StoreTextPage slug="cambios-y-garantias" />;
}
