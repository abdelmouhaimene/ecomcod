'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useStore } from '../../context/store-context';

export function FeaturedInnovations() {
  const t = useTranslations('home');
  const { addToCart } = useStore();
  const [activeFilter, setActiveFilter] = React.useState('all');

  const products = [
    {
      id: 'aura-soundbar-neo',
      name: t('products.soundbar.name'),
      tag: t('products.soundbar.tag'),
      rating: '4.9',
      price: 499,
      spec: t('products.soundbar.spec'),
      category: 'audio',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAPdWNcmUO6Z8XPULGn_SA37bIy5A13Zt8Socu7SIo_PRViaKThkdHcrBrLjJH9dMnGSKi3vNWfGmM6FDrGx-TanAgmO61emywDY_0S7Yx_asCNZ3yJgl_BOkl5S4jQK_-9SOuAR76jPfEROwKdTN0gsdYb1ptexjDoLRGniRsMn_9quc3pR8ygDOFMGU7TLzRWANx2D4CmXkkVWPk3mC8jSbgFnUrskvl1r7VeQh7wPYkgu4yy6waS1w',
    },
    {
      id: 'chronos-gold-ring',
      name: t('products.ring.name'),
      tag: t('products.ring.tag'),
      rating: '5.0',
      price: 299,
      spec: t('products.ring.spec'),
      category: 'wearables',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCiQ8tg69YLRn_8JsGltgoCgNt9uI0z6iAyUZ4HJofGcEdUYhrVUZiDSevLJHqQzw0O36YdrKV9-sk6qs_HhVC7WqJ4Xgr7CeyTP6BoqCFOtPNjbGjNC0bjKRHjWmdsM6hVwDrnFOpakPG9Wn5ZpD0l_9wFXd47_HfJDv6MZ16AaYrrHEKIKZ0VqpuyqzvqfHBy6PcgMVjmJIoAZ6uxftuQdI8kB_ww4TgGRC_yrqhfPMandlUaB5WCkg',
    },
    {
      id: 'lumina-gan-station',
      name: t('products.ganStation.name'),
      tag: t('products.ganStation.tag'),
      rating: '4.8',
      price: 129,
      spec: t('products.ganStation.spec'),
      category: 'power',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuASIpcfO6UhSD6r7Ma6E0tKsY-3UzV0acBxQsCRNL2Euhsz16xb8ircx-1WzI9RK_1K4baH87kaetN7SqoBqAC10_WCqrITIHLBm9lVssPCV33km9cfAfn136O-jggGDckiCluMfXaDJWsPGqz7OF9sANq5gmlLEerFC2Ud3HnSo_XDJBOPLNpycbkPufJJIaQzilreVrW8n6_5WhaClKz1m31LlBER1-RwwQ_e78yUdvEPL6YJZ78Luw',
    },
    {
      id: 'apex-mechanical-keyboard',
      name: t('products.keyboard.name'),
      tag: t('products.keyboard.tag'),
      rating: '4.9',
      price: 249,
      spec: t('products.keyboard.spec'),
      category: 'desk',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDZik3uVMlvjwAWZ6FzPC6Xf2FD-92ZkAlrzgERO4Dil5J0JG9tMLQWdboBngF-LHlFyHHkiE5Bl_YdaZy3KbDx8xVvm0l4uWCWoqCrnkFUehbtMG9RUhSXfY1CdUJS6yV3U8k8lHoUrahV29h_OH62oX86o8E3gt4PL8bdwmnf20kxfVa58cCLDwhCBiGDQmbpVJKZ4KylhB6A6msF_YRjm0sRWKsxqyz4lCWkdVJuNZOjt66DD4QoUA',
    },
  ];

  const filteredProducts =
    activeFilter === 'all'
      ? products
      : activeFilter === 'audio'
        ? products.filter((p) => p.category === 'audio')
        : activeFilter === 'wearables'
          ? products.filter((p) => p.category === 'wearables')
          : products;

  return (
    <section className="w-full px-margin max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-label-caps text-label-caps text-primary tracking-widest block uppercase">
            {t('mechanicalRefinement')}
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {t('featuredInnovations')}
          </h2>
        </div>
      </div>

      {/* Segment Filter Chips */}
      <div className="flex space-x-2 overflow-x-auto no-scrollbar py-1 mb-4">
        {[
          { id: 'all', label: t('filterTags.all') },
          { id: 'trending', label: t('filterTags.trending') },
          { id: 'audio', label: t('filterTags.audio') },
          { id: 'wearables', label: t('filterTags.wearables') },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full font-label-caps text-[11px] tracking-wider transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-on-surface text-surface-container-lowest font-semibold shadow-sm'
                  : 'bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:border-primary-container'
              }`}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2-Column Responsive Bento Grid (4 cols on lg screens) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {filteredProducts.map((prod) => (
          <article
            key={prod.id}
            className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 flex flex-col justify-between hover:border-primary-container/60 transition-all gold-glow-subtle group"
          >
            <div className="relative">
              {/* Badge & Rating */}
              <div className="flex items-center justify-between mb-2">
                <span className="px-1.5 py-0.5 rounded bg-surface border border-primary-container/60 text-primary font-label-caps text-[9px] font-bold">
                  {prod.tag}
                </span>
                <div className="flex items-center text-primary space-x-0.5">
                  <span
                    className="material-symbols-outlined text-[13px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <span className="font-label-numeric text-[11px] font-semibold text-on-surface">
                    {prod.rating}
                  </span>
                </div>
              </div>

              {/* Image Staging */}
              <Link
                href={`/products/aura-pro-studio`}
                className="w-full h-32 sm:h-40 rounded-lg bg-surface-container-low overflow-hidden relative flex items-center justify-center border border-outline-variant/20 mb-2.5 block"
              >
                <img
                  src={prod.image}
                  alt={prod.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </Link>

              <Link href={`/products/aura-pro-studio`}>
                <h3 className="font-title-md text-[14px] leading-tight text-on-surface font-semibold line-clamp-1 hover:text-primary transition-colors">
                  {prod.name}
                </h3>
              </Link>
              <p className="font-body-sm text-[11px] text-outline mt-0.5">{prod.spec}</p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between">
              <span className="font-label-numeric text-[15px] font-bold text-on-surface">
                ${prod.price}
              </span>
              <button
                onClick={() =>
                  addToCart({
                    id: prod.id,
                    name: prod.name,
                    sku: `AUR-${prod.id.slice(0, 3).toUpperCase()}`,
                    price: prod.price,
                    image: prod.image,
                    material: 'Precision Anodized',
                  })
                }
                aria-label={`Add ${prod.name} to Bag`}
                className="w-8 h-8 rounded-lg bg-on-surface text-surface-container-lowest flex items-center justify-center border border-primary-container/40 active:scale-90 transition-all hover:bg-primary cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">add_shopping_cart</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
