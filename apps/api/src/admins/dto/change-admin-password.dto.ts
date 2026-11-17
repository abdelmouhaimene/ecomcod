import { IsString, Length } from 'class-validator';
import type { ChangeAdminPasswordPayload } from '@repo/types';

export class ChangeAdminPasswordDto implements ChangeAdminPasswordPayload {
  @IsString()
  @Length(1, 128)
  currentPassword: string;

  @IsString()
  @Length(8, 128, { message: 'newPassword must be between 8 and 128 characters' })
  newPassword: string;
}
