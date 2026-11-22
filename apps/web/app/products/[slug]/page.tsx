import { Suspense } from 'react';
import ProductDetails, { ProductDetailsSkeleton } from './product-details';

export default function ProductDetailsPage() {
  return (
    <Suspense fallback={<ProductDetailsSkeleton />}>
      <ProductDetails />
    </Suspense>
  );
}
