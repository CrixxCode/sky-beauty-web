import { StoreTextPage, storePageMetadata } from '@/features/storefront/store-page';

export const generateMetadata = () => storePageMetadata('terminos');

export default function Page() {
  return <StoreTextPage slug="terminos" />;
}
