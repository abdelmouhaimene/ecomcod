import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { GoogleAuthController } from './google-auth.controller.js';
import { MailService } from './mail.service.js';
import { OtpService } from './otp.service.js';
import { EmailDomainService } from './email-domain.service.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { SessionService } from './session.service.js';
import { SessionGuard } from './session.guard.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    OtpService,
    MailService,
    EmailDomainService,
    GoogleOAuthService,
    SessionService,
    SessionGuard,
  ],
})
export class AuthModule { }
