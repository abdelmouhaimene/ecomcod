// mail.service.ts
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * Dev-only mailer.
 *
 * No real provider is configured, so the one-time code is written to the
 * server log instead of being emailed. This is intentional for local
 * development and is NEVER done in production (see the NODE_ENV guard below)
 * to avoid leaking live OTP codes.
 *
 * To send real email, replace this implementation with a provider
 * (Resend / Brevo / SMTP / ...) and gate it on the relevant env var.
 */
@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    async sendVerificationCode(email: string, code: string, ttlMinutes: number): Promise<void> {
        if (process.env.NODE_ENV === 'production') {
            // In production a real provider must be wired up; never log OTPs.
            throw new ServiceUnavailableException(
                'Email delivery is not configured. Set up a real mail provider.',
            );
        }

        // DEV ONLY: the code is logged so the passwordless flow can be tested
        // locally without a mail provider. Do not rely on this in production.
        this.logger.log(
            `[DEV ONLY] Verification code for ${email}: ${code} (valid for ${ttlMinutes} min)`,
        );
    }
}
