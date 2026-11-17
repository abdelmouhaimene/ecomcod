import { IsEmail, IsString, Length, Matches } from 'class-validator';
import type { ResetPasswordPayload } from '@repo/types';

export class ResetPasswordDto implements ResetPasswordPayload {
    @IsEmail()
    @Length(3, 100)
    email: string;

    @IsString()
    @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
    code: string;

    @IsString()
    @Length(8, 128, { message: 'password must be between 8 and 128 characters' })
    password: string;
}
