/** Storefront store information, managed from the dashboard. */

/** Social networks offered in the dashboard and rendered as icon buttons. */
export const SOCIAL_PLATFORMS = [
    'tiktok',
    'youtube',
    'instagram',
    'x',
    'facebook',
    'linkedin',
    'ouedkniss',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface PublicStorePhone {
    id: string;
    /** Display/filter value, kept exactly as entered. */
    number: string;
    /** Order in which phone numbers appear. */
    position: number;
}

export interface PublicStoreSocialLink {
    id: string;
    platform: SocialPlatform;
    url: string;
}

export interface PublicStoreInfo<TDate = string> {
    name: string;
    description: string;
    /** Absolute URL or API-relative upload path; empty when no logo is set. */
    logo: string;
    email: string;
    website: string;
    /** Human-readable address shown next to the map. */
    address: string;
    /** Raw value entered in the dashboard: link, coordinates or place name. */
    mapQuery: string;
    /** Google Maps link that opens the location in a new tab. */
    mapLink: string;
    /** URL ready for a Google Maps iframe; empty when no location is set. */
    mapEmbedUrl: string;
    phones: PublicStorePhone[];
    socialLinks: PublicStoreSocialLink[];
    createdAt: TDate;
    updatedAt: TDate;
}

/** Whole-store update. Phones/social links are replaced with the given lists. */
export interface StoreInfoPayload {
    name: string;
    description: string;
    logo: string;
    email: string;
    website: string;
    address: string;
    mapQuery: string;
    phones: string[];
    socialLinks: Array<{ platform: SocialPlatform; url: string }>;
}
