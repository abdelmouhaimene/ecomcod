import { getTranslations } from 'next-intl/server';
import type { PublicFaqItem } from '@repo/types';
import { catalogApi } from '../../lib/api';

export async function generateMetadata() {
    const t = await getTranslations('faq');
    return { title: t('title'), description: t('subtitle') };
}

export default async function FaqPage() {
    const t = await getTranslations('faq');

    let items: PublicFaqItem[] = [];
    let unavailable = false;
    try {
        items = await catalogApi.listActiveFaqs();
    } catch {
        unavailable = true;
    }

    return (
        <main className="w-full px-margin max-w-4xl mx-auto pt-8 pb-16 space-y-6">
            <header className="space-y-1.5">
                <span className="font-label-caps text-label-caps text-primary tracking-widest uppercase block">
                    {t('eyebrow')}
                </span>
                <h1 className="font-headline-md text-headline-md text-on-surface">{t('title')}</h1>
                <p className="font-body-sm text-body-sm text-secondary">{t('subtitle')}</p>
            </header>

            {unavailable ? (
                <p className="font-body-sm text-body-sm text-secondary rounded-xl bg-surface-container-lowest subtle-hairline p-5">
                    {t('unavailable')}
                </p>
            ) : items.length === 0 ? (
                <p className="font-body-sm text-body-sm text-secondary rounded-xl bg-surface-container-lowest subtle-hairline p-5">
                    {t('empty')}
                </p>
            ) : (
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <details
                            key={item.id}
                            className="group rounded-xl bg-surface-container-lowest subtle-hairline"
                        >
                            <summary className="faq-summary flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-4 font-body-sm text-body-sm font-medium text-on-surface hover:text-primary">
                                <span className="flex items-start gap-3">
                                    <span className="font-label-numeric text-[12px] text-primary pt-0.5">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <span className="whitespace-pre-wrap">{item.question}</span>
                                </span>
                                <span
                                    className="material-symbols-outlined text-[20px] text-primary shrink-0 transition-transform duration-200 group-open:rotate-180"
                                    aria-hidden="true"
                                >
                                    expand_more
                                </span>
                            </summary>
                            <div className="border-t border-outline-variant/30 px-4 py-4 sm:pl-[3.65rem]">
                                <p className="font-body-sm text-body-sm text-on-surface-variant whitespace-pre-wrap">
                                    {item.answer}
                                </p>
                            </div>
                        </details>
                    ))}
                </div>
            )}
        </main>
    );
}
