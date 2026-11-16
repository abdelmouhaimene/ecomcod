import { Module } from '@nestjs/common';
import { EmailAuthService } from './email/email-auth.service.js';
import { EmailAuthController } from './email/email-auth.controller.js';
import { GoogleAuthController } from './google/google-auth.controller.js';
import { MailService } from './email/mail.service.js';
import { OtpService } from './email/otp.service.js';
import { EmailDomainService } from './email/email-domain.service.js';
import { GoogleOAuthService } from './google/google-oauth.service.js';
import { SessionService } from './shared/session.service.js';
import { SessionGuard } from './shared/session.guard.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [EmailAuthController, GoogleAuthController],
  providers: [
    EmailAuthService,
    OtpService,
    MailService,
    EmailDomainService,
    GoogleOAuthService,
    SessionService,
    SessionGuard,
  ],
})
export class AuthModule { }