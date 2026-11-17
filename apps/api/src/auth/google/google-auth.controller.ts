import {
  Controller,
  Get,
  Logger,
  Query,
  Res,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { GoogleOAuthService, type GoogleState } from './google-oauth.service.js';
import { SESSION_COOKIE, SessionService } from '../shared/session.service.js';
import { UsersService } from '../../users/users.service.js';

export type GoogleAuthError =
  | 'google_denied'
  | 'invalid_state'
  | 'email_unverified'
  | 'account_disabled'
  | 'google_failed';

interface GoogleCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

/**
 * Only relative paths are accepted, so a crafted `?redirect=` cannot send the
 * browser to another origin after login (open redirect).
 */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}

@Controller({ path: ['auth', 'api/auth'], version: VERSION_NEUTRAL })
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly google: GoogleOAuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /** Starts the flow: state in Redis, then a redirect to Google's consent screen. */
  @Get('google')
  async start(@Query('redirect') redirect: unknown, @Res() res: Response): Promise<void> {
    if (!this.google.isConfigured) {
      throw new ServiceUnavailableException('Google login is not configured');
    }

    const state = await this.google.createState(safeRedirectPath(redirect));
    res.redirect(this.google.authorizationUrl(state));
  }

  /**
   * Google redirects the browser here with a one-time code. We use the same
   * session cookie as the email/OTP flow, so every protected route keeps working.
   */
  @Get(['google/callback', 'callback/google'])
  async callback(@Query() query: GoogleCallbackQuery, @Res() res: Response): Promise<void> {
    const state = await this.google.consumeState(query.state);
    if (!state) {
      return this.fail(res, 'invalid_state');
    }

    if (query.error || !query.code) {
      return this.fail(res, 'google_denied', state);
    }

    try {
      const accessToken = await this.google.exchangeCode(query.code);
      const identity = await this.google.getProfile(accessToken);

      // Only verified addresses may be linked to an existing account.
      if (!identity.emailVerified) {
        return this.fail(res, 'email_unverified', state);
      }

      const user = await this.users.findOrCreateByGoogle(identity);
      if (!user.isActive) {
        return this.fail(res, 'account_disabled', state);
      }

      const session = await this.sessions.create(user.id, true);
      res.cookie(SESSION_COOKIE, session.token, this.sessions.cookieFor(session));

      res.redirect(this.frontendUrlFor(state.redirect));
    } catch (error) {
      this.logger.warn(`Google login failed: ${(error as Error).message}`);
      this.fail(res, 'google_failed', state);
    }
  }

  private fail(res: Response, code: GoogleAuthError, state?: GoogleState): void {
    res.redirect(this.frontendUrlFor(state?.redirect ?? '/', { auth_error: code }));
  }

  private frontendUrlFor(path: string, params: Record<string, string> = {}): string {
    const base = this.frontendUrl.endsWith('/') ? this.frontendUrl : `${this.frontendUrl}/`;
    const url = new URL(safeRedirectPath(path), base);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
}
