import { getTranslations } from 'next-intl/server';
import type { PublicPolicyArticle } from '@repo/types';
import { catalogApi } from '../../lib/api';

export async function generateMetadata() {
    const t = await getTranslations('policy');
    return { title: t('title'), description: t('subtitle') };
}

export default async function PolicyPage() {
    const t = await getTranslations('policy');

    let articles: PublicPolicyArticle[] = [];
    let unavailable = false;
    try {
        articles = await catalogApi.listActivePolicies();
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
            ) : articles.length === 0 ? (
                <p className="font-body-sm text-body-sm text-secondary rounded-xl bg-surface-container-lowest subtle-hairline p-5">
                    {t('empty')}
                </p>
            ) : (
                <div className="space-y-3.5">
                    {articles.map((article, index) => (
                        <section
                            key={article.id}
                            className="rounded-xl bg-surface-container-lowest subtle-hairline p-5"
                        >
                            <div className="flex items-start gap-3">
                                <span className="font-label-numeric text-[12px] text-primary pt-1">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <div className="min-w-0 space-y-2">
                                    <h2 className="font-title-md text-title-md text-on-surface whitespace-pre-wrap">
                                        {article.title}
                                    </h2>
                                    <p className="font-body-sm text-body-sm text-on-surface-variant whitespace-pre-wrap">
                                        {article.body}
                                    </p>
                                </div>
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </main>
    );
}
