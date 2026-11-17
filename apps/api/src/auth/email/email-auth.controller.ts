import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { EmailAuthService } from './email-auth.service.js';
import { SignUpDto } from './dto/signup.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import {
  SESSION_COOKIE,
  SessionService,
  type CreatedSession,
} from '../shared/session.service.js';
import { SessionGuard, type RequestWithUser } from '../shared/session.guard.js';
import { CurrentUser } from '../shared/current-user.decorator.js';
import { UsersService } from '../../users/users.service.js';
import type { User } from '../../users/entities/user.entity.js';

@Controller({ path: 'auth', version: '1' })
export class EmailAuthController {
  constructor(
    private readonly authService: EmailAuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) { }

  private issueSession(res: Response, session: CreatedSession): void {
    res.cookie(SESSION_COOKIE, session.token, this.sessions.cookieFor(session));
  }

  /**
   * Starts a signup: email + password are validated and kept in Redis until
   * the verification code is confirmed. No account exists yet.
   */
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  signup(@Body() signUpDto: SignUpDto) {
    return this.authService.signup(signUpDto);
  }

  /** Confirms the code, creates the account in Postgres and signs the user in. */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(verifyEmailDto);
    this.issueSession(res, await this.sessions.create(result.user.id, true));
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.issueSession(res, await this.sessions.create(result.user.id, dto.rememberMe === true));
    return result;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /** Verifies the reset code, stores the new password and signs the user in. */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.resetPassword(dto);
    this.issueSession(res, await this.sessions.create(result.user.id, false));
    return result;
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@CurrentUser() user: User) {
    const full = await this.users.findByIdWithPassword(user.id);
    return this.users.toMe(full ?? user);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req as RequestWithUser).cookies?.[SESSION_COOKIE] as string | undefined;
    await this.sessions.destroy(token);
    res.clearCookie(SESSION_COOKIE, this.sessions.cookieOptions);
  }
}
