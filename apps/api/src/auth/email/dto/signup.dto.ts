import { IsEmail, Length } from 'class-validator';

export class SignUpDto {
    @IsEmail()
    @Length(3, 100)
    email: string;
}
