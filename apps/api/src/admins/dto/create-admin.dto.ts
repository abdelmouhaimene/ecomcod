import { IsIn, IsString, Length, Matches } from 'class-validator';
import { AdminRole, type CreateAdminPayload, type CreatableAdminRole } from '@repo/types';

/** Only managers and agents can be created; the system admin is seeded once. */
export class CreateAdminDto implements CreateAdminPayload {
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may only contain letters, numbers, dots, dashes and underscores',
  })
  username: string;

  @IsString()
  @Length(8, 128, { message: 'password must be between 8 and 128 characters' })
  password: string;

  @IsIn([AdminRole.MANAGER, AdminRole.AGENT], {
    message: 'role must be manager or agent',
  })
  role: CreatableAdminRole;
}
