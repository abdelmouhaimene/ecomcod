import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Admin } from '../entities/admin.entity.js';
import type { RequestWithAdmin } from '../guards/admin.guard.js';

/** Injects the admin resolved by AdminGuard. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Admin => {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    if (!request.admin) {
      throw new Error('CurrentAdmin used without AdminGuard');
    }
    return request.admin;
  },
);
