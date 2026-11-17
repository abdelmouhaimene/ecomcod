import { IsEmail, IsString, Length } from 'class-validator';

export class SignUpDto {
    @IsEmail()
    @Length(3, 100)
    email: string;

    @IsString()
    @Length(8, 128, { message: 'password must be between 8 and 128 characters' })
    password: string;
}
