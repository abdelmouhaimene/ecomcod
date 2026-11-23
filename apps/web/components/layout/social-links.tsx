'use client';

import type { PublicStoreSocialLink, SocialPlatform } from '@repo/types';

const LABELS: Record<SocialPlatform, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  x: 'X',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  ouedkniss: 'Ouedkniss',
};

/** Brand glyphs are inline so the storefront needs no icon-font dependency. */
function BrandIcon({ platform }: { platform: SocialPlatform }) {
  switch (platform) {
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
          <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.8c0-.9.3-1.5 1.5-1.5h1.6V4.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2h-2.5v3h2.5V21z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="4" />
          <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'x':
      return (
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="currentColor" aria-hidden="true">
          <path d="M18 3h3l-6.6 7.6L22 21h-6l-4.7-6.1L6 21H3l7.1-8.1L2.5 3h6.2l4.2 5.6z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
          <path d="M16.5 2c.3 2.4 1.8 3.9 4.2 4.2v3.3c-1.6.1-3.1-.4-4.3-1.4v6.8c0 4.1-3.1 6.6-6.8 6.6-3.5 0-6.1-2.4-6.1-5.9 0-3.7 3.1-6.3 7-6v3.4c-2.1-.2-3.5.9-3.5 2.5 0 1.5 1.1 2.6 2.7 2.6 1.8 0 2.9-1.4 2.9-3.4V2z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
          <path d="M5 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9.5h4V21H3zM9 9.5h3.8v1.6h.1c.6-1 1.9-1.9 3.7-1.9 4 0 4.4 2.6 4.4 6V21h-4v-5.4c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21H9z" />
        </svg>
      );
    case 'ouedkniss':
      // Ouedkniss has no widely available brand glyph: use a compact wordmark.
      return <span className="font-label-caps text-[11px] font-bold tracking-tight">OK</span>;
  }
}

/** Icon buttons for the social profiles configured in the dashboard. */
export function SocialLinks({
  links,
  className = '',
}: {
  links: PublicStoreSocialLink[];
  className?: string;
}) {
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={LABELS[link.platform]}
          title={LABELS[link.platform]}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/50 bg-surface-container-lowest text-primary transition-colors hover:bg-primary hover:text-on-primary"
        >
          <BrandIcon platform={link.platform} />
        </a>
      ))}
    </div>
  );
}
