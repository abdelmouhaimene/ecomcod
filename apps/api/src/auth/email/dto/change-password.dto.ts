import { IsString, Length } from 'class-validator';

export class ChangePasswordDto {
    @IsString()
    @Length(1, 128)
    currentPassword: string;

    @IsString()
    @Length(8, 128, { message: 'password must be between 8 and 128 characters' })
    newPassword: string;
}
