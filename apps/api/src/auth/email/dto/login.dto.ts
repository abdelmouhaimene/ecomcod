import { IsBoolean, IsEmail, IsOptional, IsString, Length } from 'class-validator';
import type { LoginPayload } from '@repo/types';

export class LoginDto implements LoginPayload {
    @IsEmail()
    @Length(3, 100)
    email: string;

    @IsString()
    @Length(1, 128)
    password: string;

    /** Persistent cookie (Max-Age) instead of a browser-session cookie. */
    @IsOptional()
    @IsBoolean()
    rememberMe?: boolean;
}
