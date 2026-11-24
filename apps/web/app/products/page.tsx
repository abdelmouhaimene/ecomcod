import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { PaginatedProducts, PublicCategory } from '@repo/types';
import { ProductCard } from '../../components/catalog/product-card';
import { catalogApi } from '../../lib/api';

const PAGE_SIZE = 9;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SearchValue = string | string[] | undefined;

function firstValue(value: SearchValue): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function parsePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata() {
  const t = await getTranslations('products');
  return { title: t('title'), description: t('subtitle') };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = parsePage(firstValue(params.page));
  const q = firstValue(params.q).trim().slice(0, 120);
  const requestedCategory = firstValue(params.categoryId).trim();
  const categoryId = UUID_V4.test(requestedCategory) ? requestedCategory : '';

  const [productsResult, categoriesResult] = await Promise.allSettled([
    catalogApi.listProducts({
      page,
      limit: PAGE_SIZE,
      q: q || undefined,
      categoryId: categoryId || undefined,
    }),
    catalogApi.listCategories(),
  ]);

  const emptyListing: PaginatedProducts = {
    items: [],
    total: 0,
    page,
    limit: PAGE_SIZE,
    totalPages: 0,
  };
  const listing = productsResult.status === 'fulfilled' ? productsResult.value : emptyListing;
  const categories: PublicCategory[] =
    categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];

  const t = await getTranslations('products');
  const hrefForPage = (target: number): string => {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (categoryId) query.set('categoryId', categoryId);
    if (target > 1) query.set('page', String(target));
    const serialized = query.toString();
    return `/products${serialized ? `?${serialized}` : ''}`;
  };
  const hasFilters = q.length > 0 || categoryId.length > 0;
  const firstItem = listing.total === 0 ? 0 : (listing.page - 1) * listing.limit + 1;
  const lastItem = Math.min(listing.page * listing.limit, listing.total);

  return (
    <main className="w-full px-margin max-w-7xl mx-auto pt-6 pb-12 space-y-5">
      <header className="space-y-1.5">
        <span className="font-label-caps text-label-caps text-primary tracking-widest uppercase block">
          {t('eyebrow')}
        </span>
        <h1 className="font-headline-md text-headline-md text-on-surface">{t('title')}</h1>
        <p className="font-body-sm text-body-sm text-secondary">{t('subtitle')}</p>
      </header>

      {/* Plain GET form: typing never fetches; only the submit button navigates. */}
      <form
        action="/products"
        method="get"
        className="flex flex-col sm:flex-row gap-2.5 rounded-xl bg-surface-container-lowest subtle-hairline p-3"
      >
        <label className="sr-only" htmlFor="catalog-search">
          {t('searchLabel')}
        </label>
        <input
          id="catalog-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t('searchPlaceholder')}
          className="font-body-sm flex-1 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-on-surface outline-none focus:border-primary-container"
        />
        <label className="sr-only" htmlFor="catalog-category">
          {t('categoryLabel')}
        </label>
        <select
          id="catalog-category"
          name="categoryId"
          defaultValue={categoryId}
          className="font-body-sm rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-on-surface outline-none focus:border-primary-container"
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="font-label-caps rounded-lg bg-on-surface text-surface-container-lowest px-4 py-2 cursor-pointer hover:bg-primary transition-colors"
        >
          {t('search')}
        </button>
      </form>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-body-sm text-body-sm text-secondary">
          {t('showing', { first: firstItem, last: lastItem, total: listing.total })}
        </p>
        {hasFilters ? (
          <Link
            href="/products"
            className="font-label-caps text-label-caps text-primary hover:underline underline-offset-4"
          >
            {t('clear')}
          </Link>
        ) : null}
      </div>

      {listing.items.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest subtle-hairline p-10 text-center">
          <span className="material-symbols-outlined text-[34px] text-outline">inventory_2</span>
          <p className="font-body-sm text-secondary mt-2">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
          {listing.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {listing.totalPages > 1 ? (
        <nav
          aria-label={t('paginationLabel')}
          className="flex items-center justify-center gap-1.5 flex-wrap pt-2"
        >
          {listing.page > 1 ? (
            <Link
              href={hrefForPage(listing.page - 1)}
              aria-label={t('previous')}
              className="w-9 h-9 rounded-lg border border-outline-variant/50 flex items-center justify-center text-on-surface hover:border-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </Link>
          ) : null}

          {Array.from({ length: listing.totalPages }, (_, index) => index + 1).map((target) => (
            <Link
              key={target}
              href={hrefForPage(target)}
              aria-label={t('goTo', { page: target })}
              aria-current={target === listing.page ? 'page' : undefined}
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-label-numeric text-[13px] ${
                target === listing.page
                  ? 'bg-on-surface text-surface-container-lowest'
                  : 'border border-outline-variant/50 text-on-surface hover:border-primary-container'
              }`}
            >
              {target}
            </Link>
          ))}

          {listing.page < listing.totalPages ? (
            <Link
              href={hrefForPage(listing.page + 1)}
              aria-label={t('next')}
              className="w-9 h-9 rounded-lg border border-outline-variant/50 flex items-center justify-center text-on-surface hover:border-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
