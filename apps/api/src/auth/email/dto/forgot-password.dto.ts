import { IsEmail, Length } from 'class-validator';
import type { ForgotPasswordPayload } from '@repo/types';

export class ForgotPasswordDto implements ForgotPasswordPayload {
    @IsEmail()
    @Length(3, 100)
    email: string;
}
