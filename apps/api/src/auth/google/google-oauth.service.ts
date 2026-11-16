import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module.js';
import type { GoogleIdentity } from '../../users/users.service.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/** How long the user has to finish the consent screen. */
const STATE_TTL_S = 10 * 60;

export interface GoogleState {
  /** Where to send the browser back inside the web app. */
  redirect: string;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';

    const port = config.get<number>('PORT') ?? 3002;
    // Keep in sync with the "Authorized redirect URI" in Google Console.
    this.callbackUrl =
      config.get<string>('GOOGLE_CALLBACK_URL') ||
      `http://localhost:${port}/api/auth/callback/google`;
  }

  /** Google login stays optional: the rest of the API works without credentials. */
  get isConfigured(): boolean {
    return this.clientId.length > 0 && this.clientSecret.length > 0;
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Google login is not configured');
    }
  }

  /**
   * Stores an opaque, single-use CSRF nonce in Redis. The redirect target lives
   * server-side, so the query string cannot be used to send users elsewhere.
   */
  async createState(redirect: string): Promise<string> {
    this.assertConfigured();

    const state = randomBytes(32).toString('base64url');
    const payload: GoogleState = { redirect };
    await this.redis.set(`oauth:state:${state}`, JSON.stringify(payload), 'EX', STATE_TTL_S);
    return state;
  }

  /** Returns the state payload once, then forgets it. */
  async consumeState(state: string | undefined): Promise<GoogleState | null> {
    if (!state) return null;

    const key = `oauth:state:${state}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    await this.redis.del(key);

    try {
      const parsed = JSON.parse(raw) as Partial<GoogleState>;
      return { redirect: typeof parsed.redirect === 'string' ? parsed.redirect : '/' };
    } catch {
      return null;
    }
  }

  authorizationUrl(state: string): string {
    this.assertConfigured();

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });

    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Exchanges the one-time code for an access token. The token endpoint is
   * called server-to-server, so the client secret never reaches the browser.
   */
  async exchangeCode(code: string): Promise<string> {
    this.assertConfigured();

    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.callbackUrl,
      grant_type: 'authorization_code',
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      this.logger.warn(`Google token exchange failed with HTTP ${response.status}`);
      throw new Error('Google token exchange failed');
    }

    const data = (await response.json()) as { access_token?: unknown };
    if (typeof data.access_token !== 'string') {
      throw new Error('Google token response has no access_token');
    }
    return data.access_token;
  }

  /** Reads the profile straight from Google, so the data is trusted. */
  async getProfile(accessToken: string): Promise<GoogleIdentity> {
    const response = await fetch(USERINFO_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      this.logger.warn(`Google userinfo failed with HTTP ${response.status}`);
      throw new Error('Google userinfo failed');
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (typeof data.sub !== 'string' || typeof data.email !== 'string') {
      throw new Error('Google userinfo is missing sub/email');
    }

    return {
      googleId: data.sub,
      email: data.email.trim().toLowerCase(),
      fullName: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null,
      emailVerified: data.email_verified === true,
    };
  }
}
