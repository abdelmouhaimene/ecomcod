import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyEmailDto {
    @IsEmail()
    @Length(3, 100)
    email: string;

    @IsString()
    @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
    code: string;
}
