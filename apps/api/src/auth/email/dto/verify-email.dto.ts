import { IsEmail, IsString, Length, Matches } from 'class-validator';
import type { VerifyEmailPayload } from '@repo/types';

export class VerifyEmailDto implements VerifyEmailPayload {
    @IsEmail()
    @Length(3, 100)
    email: string;

    @IsString()
    @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
    code: string;
}
