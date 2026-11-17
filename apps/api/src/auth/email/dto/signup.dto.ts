import { IsEmail, IsString, Length } from 'class-validator';
import type { SignUpPayload } from '@repo/types';

export class SignUpDto implements SignUpPayload {
    @IsEmail()
    @Length(3, 100)
    email: string;

    @IsString()
    @Length(8, 128, { message: 'password must be between 8 and 128 characters' })
    password: string;
}
