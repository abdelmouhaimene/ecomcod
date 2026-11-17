import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@repo/types';

export const ADMIN_ROLES_KEY = 'adminRoles';

/** Restricts a route (or controller) to the given admin roles. */
export const Roles = (...roles: AdminRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ADMIN_ROLES_KEY, roles);
