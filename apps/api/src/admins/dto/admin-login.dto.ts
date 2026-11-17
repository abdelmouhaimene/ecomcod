import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import type { AdminLoginPayload } from '@repo/types';

export class AdminLoginDto implements AdminLoginPayload {
  @IsString()
  @Length(3, 50)
  username: string;

  @IsString()
  @Length(1, 128)
  password: string;

  /** Persistent admin cookie (Max-Age) instead of a browser-session cookie. */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
