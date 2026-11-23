import { toMapEmbedUrl, toMapLink } from './store-map.util.js';

describe('store map helpers', () => {
    it('returns empty URLs when no location is configured', () => {
        expect(toMapLink('')).toBe('');
        expect(toMapEmbedUrl('')).toBe('');
    });

    it('accepts plain coordinates', () => {
        expect(toMapLink('36.7538, 3.0588')).toBe('https://www.google.com/maps?q=36.7538,3.0588');
        expect(toMapEmbedUrl('36.7538, 3.0588')).toContain('q=36.7538%2C3.0588');
        expect(toMapEmbedUrl('36.7538, 3.0588')).toContain('output=embed');
    });

    it('accepts a place name as a search query', () => {
        expect(toMapEmbedUrl('540 Madison Ave New York')).toContain(
            'q=540+Madison+Ave+New+York'
        );
    });

    it('converts a Google Maps place link with coordinates', () => {
        const link =
            'https://www.google.com/maps/place/Grand+Central+Terminal/@40.7527,-73.9772,17z/data=!3m1!4b1';
        expect(toMapLink(link)).toBe(link);
        expect(toMapEmbedUrl(link)).toContain('q=40.7527%2C-73.9772');
    });

    it('keeps an existing Google Maps embed URL and rejects other sites', () => {
        const embed = 'https://www.google.com/maps/embed?pb=test';
        expect(toMapEmbedUrl(embed)).toBe(embed);
        expect(toMapEmbedUrl('https://example.com/map')).toBe('');
    });
});
