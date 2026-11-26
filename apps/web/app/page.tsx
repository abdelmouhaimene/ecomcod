'use client';

import * as React from 'react';
import { CuratedDrops } from '../components/home/curated-drops';
import { CuratedCategories } from '../components/home/curated-categories';
import { CategoryProducts } from '../components/home/category-products';
import { FeaturedVideoSection } from '../components/home/featured-video-section';
import { ClientAppraisals } from '../components/home/client-appraisals';
import { GallerySection } from '../components/home/gallery-section';

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = React.useState('');

  return (
    <div className="w-full flex flex-col space-y-9 pt-4 min-h-screen">
      {/* 1. BEST OFFERS & PROMOTIONS SWIPER */}
      <CuratedDrops />

      {/* 2. CATEGORIES + FILTERED PRODUCTS */}
      <CuratedCategories
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      >
        <CategoryProducts selectedCategory={selectedCategory} />
      </CuratedCategories>

      {/* 3. OPTIONAL YOUTUBE VIDEO (visibility managed from the dashboard) */}
      <FeaturedVideoSection />

      {/* 4. CLIENT REVIEWS & TESTIMONIALS SECTION */}
      <ClientAppraisals />

      {/* 5. HOME GALLERY (visibility managed from the dashboard) */}
      <GallerySection />
    </div>
  );
}
