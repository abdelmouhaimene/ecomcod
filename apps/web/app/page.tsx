'use client';

import * as React from 'react';
import { CuratedDrops } from '../components/home/curated-drops';
import { CuratedCategories } from '../components/home/curated-categories';
import { FeaturedInnovations } from '../components/home/featured-innovations';
import { ClientAppraisals } from '../components/home/client-appraisals';
import { Footer } from '../components/layout/footer';

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = React.useState('audio');

  return (
    <div className="w-full flex flex-col space-y-9 pt-4 min-h-screen">
      {/* 1. BEST OFFERS & PROMOTIONS SWIPER */}
      <CuratedDrops />

      {/* 2. CURATED CATEGORIES SECTION */}
      <CuratedCategories
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* 3. FEATURED TECH PRODUCTS SECTION */}
      <FeaturedInnovations />

      {/* 4. CLIENT REVIEWS & TESTIMONIALS SECTION */}
      <ClientAppraisals />

      {/* 5. FOOTER SECTION */}
      <Footer />
    </div>
  );
}
