'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { PublicComment } from '@repo/types';
import { useAuth } from '../../context/auth-context';
import { catalogApi } from '../../lib/api';
import { resolveMediaUrl } from '../../lib/catalog';

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

export function ClientAppraisals() {
  const t = useTranslations('home.appraisals');
  const { user, status } = useAuth();
  const [comments, setComments] = React.useState<PublicComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [content, setContent] = React.useState('');
  const [rating, setRating] = React.useState(5);
  const [submitting, setSubmitting] = React.useState(false);
  const [notice, setNotice] = React.useState<'success' | 'error' | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const canComment = status === 'authenticated' && Boolean(user?.emailVerifiedAt);

  const loadComments = React.useCallback(async () => {
    try {
      setComments(await catalogApi.listComments());
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadComments();
  }, [loadComments]);

  /** Same card-position logic as the offers carousel; RTL-safe. */
  const cardPosition = React.useCallback(
    (card: HTMLElement, container: HTMLElement) =>
      card.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft,
    []
  );

  const goToCard = React.useCallback(
    (index: number) => {
      const container = scrollRef.current;
      const card = container?.children[index];
      if (!(container instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
      container.scrollTo({ left: cardPosition(card, container), behavior: 'smooth' });
      setActiveIndex(index);
    },
    [cardPosition]
  );

  const handleScroll = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const cards = Array.from(container.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );
    if (cards.length === 0) return;

    const leftEdge = container.scrollLeft;
    let nearest = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const distance = Math.abs(cardPosition(card, container) - leftEdge);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });
    setActiveIndex((current) => (current === nearest ? current : nearest));
  }, [cardPosition]);

  React.useEffect(() => {
    if (activeIndex >= comments.length) setActiveIndex(0);
  }, [comments.length, activeIndex]);

  const dotCount = Math.min(3, comments.length);
  const dotStart = Math.min(Math.max(activeIndex - 1, 0), Math.max(0, comments.length - dotCount));
  const visibleDots = Array.from({ length: dotCount }, (_, offset) => dotStart + offset);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (!canComment || content.trim().length < 3) return;

    setSubmitting(true);
    try {
      const created = await catalogApi.createComment({
        content: content.trim(),
        rating,
      });
      setComments((current) => [created, ...current]);
      setContent('');
      setRating(5);
      setActiveIndex(0);
      scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      setNotice('success');
    } catch {
      setNotice('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="w-full px-margin max-w-7xl mx-auto">
      <div className="p-5 sm:p-7 rounded-2xl bg-surface-container-low/60 border border-outline-variant/40 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="font-label-caps text-label-caps text-primary tracking-widest block uppercase">
              {t('badge')}
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('title')}</h2>
          </div>
          <div className="flex text-primary" aria-hidden="true">
            {[...Array(5)].map((_, index) => (
              <span
                key={index}
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="font-body-sm text-body-sm text-secondary py-8 text-center">{t('loading')}</p>
        ) : comments.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-surface-container-lowest subtle-hairline">
            <p className="font-body-sm text-secondary">{t('empty')}</p>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory"
            >
              {comments.map((comment) => {
                const imageUrl = resolveMediaUrl(comment.userImage);
                return (
                  <div key={comment.id} className="w-full flex-shrink-0 snap-center">
                    <div className="p-4 sm:p-6 rounded-xl bg-surface-container-lowest border border-primary-container/30 shadow-sm relative h-full">
                      <span className="material-symbols-outlined text-primary-container/20 text-[48px] absolute right-4 top-3 pointer-events-none select-none">
                        format_quote
                      </span>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-surface border border-primary-container/60 text-primary font-label-caps text-[10px] flex items-center space-x-1">
                            <span
                              className="material-symbols-outlined text-[13px] text-primary"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              verified
                            </span>
                            <span>{t('collector')}</span>
                          </span>
                          <span className="font-label-numeric text-[11px] text-outline">
                            {comment.rating}/5
                          </span>
                        </div>
                        <div className="flex text-primary" aria-label={`${comment.rating}/5`}>
                          {[...Array(5)].map((_, index) => (
                            <span
                              key={index}
                              className="material-symbols-outlined text-[14px]"
                              style={{ fontVariationSettings: index < comment.rating ? "'FILL' 1" : undefined }}
                            >
                              star
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="font-body-md text-on-surface italic leading-relaxed text-[15px] max-w-3xl">
                        {comment.content}
                      </p>

                      {/* Reviewer info */}
                      <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full border border-primary-container overflow-hidden bg-surface-container flex items-center justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={t('imageAlt', { name: comment.username })}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-label-caps text-[11px] text-primary">
                              {initials(comment.username)}
                            </span>
                          )}
                        </div>
                        <h4 className="font-title-md text-[14px] text-on-surface font-semibold leading-tight">
                          {comment.username}
                        </h4>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Carousel controls */}
            <div className="flex justify-center items-center space-x-2 mt-4">
              <button
                type="button"
                onClick={() => goToCard(Math.max(0, activeIndex - 1))}
                disabled={activeIndex === 0}
                aria-label={t('previous')}
                className="w-6 h-6 rounded-full border border-outline-variant/60 flex items-center justify-center text-primary disabled:opacity-30 hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">chevron_left</span>
              </button>
              {visibleDots.map((index) => (
                <button
                  key={comments[index]?.id ?? index}
                  type="button"
                  onClick={() => goToCard(index)}
                  aria-label={t('goTo', { index: index + 1 })}
                  aria-current={activeIndex === index}
                  className={`h-1 rounded-full transition-all duration-200 cursor-pointer ${
                    activeIndex === index
                      ? 'w-4 bg-primary'
                      : 'w-1.5 bg-outline-variant hover:bg-primary/50'
                  }`}
                />
              ))}
              <button
                type="button"
                onClick={() => goToCard(Math.min(comments.length - 1, activeIndex + 1))}
                disabled={activeIndex >= comments.length - 1}
                aria-label={t('next')}
                className="w-6 h-6 rounded-full border border-outline-variant/60 flex items-center justify-center text-primary disabled:opacity-30 hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
            </div>
          </>
        )}

        {/* Verified-user comment form */}
        <div className="mt-5 pt-4 border-t border-outline-variant/30">
          {status === 'loading' ? null : canComment ? (
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 max-w-2xl">
              <div>
                <h3 className="font-title-md text-[14px] font-semibold text-on-surface">
                  {t('formTitle')}
                </h3>
                <p className="font-body-sm text-[11px] text-outline">{t('formDescription')}</p>
              </div>
              <label className="block">
                <span className="font-label-caps text-[10px] text-on-surface-variant">
                  {t('contentLabel')}
                </span>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  minLength={3}
                  maxLength={1000}
                  required
                  rows={3}
                  placeholder={t('contentPlaceholder')}
                  className="mt-1 w-full rounded-lg bg-surface-container-lowest border border-outline-variant/60 p-2.5 font-body-sm text-on-surface"
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2">
                  <span className="font-label-caps text-[10px] text-on-surface-variant">
                    {t('ratingLabel')}
                  </span>
                  <select
                    value={rating}
                    onChange={(event) => setRating(Number(event.target.value))}
                    className="rounded-lg bg-surface-container-lowest border border-outline-variant/60 px-2 py-1 font-label-numeric text-[12px] text-on-surface"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}/5
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={submitting || content.trim().length < 3}
                  className="px-4 py-2 rounded-lg bg-on-surface text-surface-container-lowest font-label-caps text-[11px] tracking-wider hover:bg-primary disabled:opacity-40 cursor-pointer"
                >
                  {submitting ? t('submitting') : t('submit')}
                </button>
              </div>
              {notice ? (
                <p
                  className={`font-body-sm text-[11px] ${notice === 'success' ? 'text-primary' : 'text-error'}`}
                  role="status"
                >
                  {notice === 'success' ? t('success') : t('error')}
                </p>
              ) : null}
            </form>
          ) : status === 'anonymous' ? (
            <p className="font-body-sm text-[12px] text-secondary">
              {t('verifiedOnly')}{' '}
              <Link href="/login" className="text-primary hover:underline underline-offset-4">
                {t('signIn')}
              </Link>
            </p>
          ) : (
            <p className="font-body-sm text-[12px] text-secondary">{t('verifyEmail')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
