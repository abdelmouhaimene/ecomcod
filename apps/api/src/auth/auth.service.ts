import { Injectable, BadRequestException } from '@nestjs/common';
import * as mailchecker from 'mailchecker';
import { SignUpDto } from './dto/signup.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { EmailDomainService } from './email-domain.service.js';
import { OtpService } from './otp.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly emailDomain: EmailDomainService,
    private readonly users: UsersService,
  ) { }

  /**
   * Step 1 of the passwordless flow: validate the address and send a code.
   * The same endpoint is used for signup and login.
   */
  async signup(signUpDto: SignUpDto) {
    const email = signUpDto.email.trim().toLowerCase();

    if (!mailchecker.isValid(email)) {
      throw new BadRequestException('Please use a permanent email address');
    }

    if (!(await this.emailDomain.hasValidMailServer(email))) {
      throw new BadRequestException('Please use a valid email address');
    }

    await this.otp.requestCode(email);

    return { message: `Verification code sent to ${email}` };
  }

  /**
   * Step 2 of the flow: check the code, then create/load the user.
   * Opening a session will be added in the next step.
   */
  async verifyEmail(dto: VerifyEmailDto) {
    await this.otp.verifyCode(dto.email, dto.code);

    const user = await this.users.findOrCreateByEmail(dto.email);

    return { verified: true, user: this.users.toPublic(user) };
  }
}
