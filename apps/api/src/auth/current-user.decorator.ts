import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../users/entities/user.entity.js';
import type { RequestWithUser } from './session.guard.js';

/** Injects the user resolved by SessionGuard. */
export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): User => {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        if (!request.user) {
            throw new Error('CurrentUser used without SessionGuard');
        }
        return request.user;
    },
);
