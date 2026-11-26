/** Helpers for the optional storefront YouTube section. */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts an 11-character YouTube video id from watch, youtu.be, shorts,
 * live, or embed links. Returns null for anything else.
 */
export function parseYouTubeVideoId(value: string): string | null {
    const raw = value.trim();
    if (!raw) return null;

    try {
        const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
        let id: string | null = null;

        if (host === 'youtu.be') {
            id = url.pathname.split('/').filter(Boolean)[0] ?? null;
        } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
            if (url.pathname === '/watch') {
                id = url.searchParams.get('v');
            } else {
                id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ?? null;
            }
        }

        if (!id) return null;
        const videoId = decodeURIComponent(id);
        return VIDEO_ID.test(videoId) ? videoId : null;
    } catch {
        return null;
    }
}

/** Privacy-friendly embed URL for a validated YouTube link; empty when invalid. */
export function toYouTubeEmbedUrl(value: string): string {
    const videoId = parseYouTubeVideoId(value);
    return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : '';
}
