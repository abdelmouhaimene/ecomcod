/**
 * Turns the dashboard's free-form location field into Google Maps URLs.
 *
 * Accepted input: a Google Maps link (place/share/embed), `latitude,longitude`,
 * or a place/address string. The raw value is kept for editing, while the
 * derived URLs are what the storefront renders.
 */

const COORDINATES = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/;

function isGoogleHost(host: string): boolean {
    return /(^|\.)google\.[a-z]{2,}(\.[a-z]{2,})?$/.test(host) || /(^|\.)goo\.gl$/.test(host);
}

function embedUrl(query: string): string {
    const params = new URLSearchParams({ q: query, output: 'embed' });
    return `https://www.google.com/maps?${params.toString()}`;
}

/** Link used by the "Open in Google Maps" button. */
export function toMapLink(value: string): string {
    const query = value.trim();
    if (!query) return '';
    if (/^https?:\/\//i.test(query)) return query;

    const coordinates = query.match(COORDINATES);
    if (coordinates) {
        return `https://www.google.com/maps?q=${coordinates[1]},${coordinates[2]}`;
    }
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
}

/** URL used as the `src` of the storefront map iframe. */
export function toMapEmbedUrl(value: string): string {
    const query = value.trim();
    if (!query) return '';

    const coordinates = query.match(COORDINATES);
    if (coordinates) return embedUrl(`${coordinates[1]},${coordinates[2]}`);

    if (!/^https?:\/\//i.test(query)) return embedUrl(query);

    try {
        const url = new URL(query);
        const host = url.hostname.toLowerCase();
        if (!isGoogleHost(host)) return '';

        // The "Embed a map" URL is already iframe-ready.
        if (/\/maps\/embed/i.test(url.pathname)) return url.toString();

        // Place links include `@latitude,longitude` in the path.
        const at = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
        if (at) return embedUrl(`${at[1]},${at[2]}`);

        const q = url.searchParams.get('q');
        if (q) return embedUrl(q);

        const place = url.pathname.match(/\/maps\/place\/([^/]+)/);
        if (place) {
            return embedUrl(decodeURIComponent(place[1]).replace(/\+/g, ' '));
        }

        // Short links (goo.gl / maps.app.goo.gl) cannot be resolved offline.
        return '';
    } catch {
        return '';
    }
}
