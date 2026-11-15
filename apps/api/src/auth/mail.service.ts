// mail.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    async sendVerificationCode(email: string, code: string, ttlMinutes: number): Promise<void> {
        // TODO: send through the real provider (SMTP / Resend / Brevo / ...).
        // Until one is configured, log the code so the signup flow can be tested locally.
        this.logger.log(`Verification code for ${email}: ${code} (valid for ${ttlMinutes} min)`);
    }
}
