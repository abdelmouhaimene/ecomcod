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
import { SESSION_COOKIE, SessionService } from '../shared/session.service.js';
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

  @Post('signup')
  @HttpCode(HttpStatus.OK)
  signup(@Body() signUpDto: SignUpDto) {
    return this.authService.signup(signUpDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(verifyEmailDto);
    const { token, maxAge } = await this.sessions.create(result.user.id);

    res.cookie(SESSION_COOKIE, token, { ...this.sessions.cookieOptions, maxAge });

    return result;
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: User) {
    return this.users.toPublic(user);
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
