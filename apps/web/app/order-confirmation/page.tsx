import { Suspense } from 'react';
import OrderConfirmation, { OrderConfirmationSkeleton } from './order-confirmation';

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<OrderConfirmationSkeleton />}>
      <OrderConfirmation />
    </Suspense>
  );
}
