import type { Metadata } from 'next';
import { Suspense } from 'react';
import { catalogApi } from '../../../lib/api';
import OfferDetails, { OfferDetailsSkeleton } from './offer-details';

type OfferPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: OfferPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const offer = await catalogApi.getOffer(id);
    return { title: offer.name };
  } catch {
    return { title: 'Offer' };
  }
}

export default function OfferPage() {
  return (
    <Suspense fallback={<OfferDetailsSkeleton />}>
      <OfferDetails />
    </Suspense>
  );
}
