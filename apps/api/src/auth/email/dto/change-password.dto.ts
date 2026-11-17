import { IsString, Length } from 'class-validator';
import type { ChangePasswordPayload } from '@repo/types';

export class ChangePasswordDto implements ChangePasswordPayload {
    @IsString()
    @Length(1, 128)
    currentPassword: string;

    @IsString()
    @Length(8, 128, { message: 'password must be between 8 and 128 characters' })
    newPassword: string;
}
