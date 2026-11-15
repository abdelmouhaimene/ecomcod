// email-domain.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import { domainToASCII } from 'node:url';

type Entry = { valid: boolean; expires: number };

@Injectable()
export class EmailDomainService {
    private readonly logger = new Logger(EmailDomainService.name);
    private readonly resolver = new Resolver({ timeout: 2000, tries: 2 });
    private readonly cache = new Map<string, Entry>();

    async hasValidMailServer(email: string): Promise<boolean> {
        const raw = email.trim().toLowerCase().split('@').pop();
        const domain = raw ? domainToASCII(raw) : '';
        if (!domain) return false;

        const hit = this.cache.get(domain);
        if (hit && hit.expires > Date.now()) return hit.valid;

        const result = await this.lookup(domain);
        if (result !== 'transient') {
            const valid = result === 'valid';
            const ttl = valid ? 6 * 3600_000 : 5 * 60_000;
            this.cache.set(domain, { valid, expires: Date.now() + ttl });
            return valid;
        }
        return true; // fail open on transient DNS errors
    }

    private async lookup(domain: string): Promise<'valid' | 'invalid' | 'transient'> {
        try {
            const mx = await this.resolver.resolveMx(domain);
            const usable = mx.filter((r) => r.exchange && r.exchange !== '.');
            if (usable.length > 0) return 'valid';
            if (mx.length > 0) return 'invalid'; // null MX (RFC 7505)
        } catch (err: any) {
            if (!['ENOTFOUND', 'ENODATA'].includes(err.code)) {
                this.logger.warn(`MX lookup failed for ${domain}: ${err.code}`);
                return 'transient';
            }
        }

        // Implicit MX fallback: A / AAAA
        for (const fn of [
            () => this.resolver.resolve4(domain),
            () => this.resolver.resolve6(domain),
        ]) {
            try {
                if ((await fn()).length > 0) return 'valid';
            } catch (err: any) {
                if (!['ENOTFOUND', 'ENODATA'].includes(err.code)) return 'transient';
            }
        }
        return 'invalid';
    }
}