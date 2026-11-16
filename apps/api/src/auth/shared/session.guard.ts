import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service.js';
import type { User } from '../../users/entities/user.entity.js';
import { SESSION_COOKIE, SessionService } from './session.service.js';

export interface RequestWithUser extends Request {
    user?: User;
}

@Injectable()
export class SessionGuard implements CanActivate {
    constructor(
        private readonly sessions: SessionService,
        private readonly users: UsersService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const token = request.cookies?.[SESSION_COOKIE] as string | undefined;

        const userId = await this.sessions.getUserId(token);
        if (!userId) {
            throw new UnauthorizedException('Not authenticated');
        }

        const user = await this.users.findById(userId);
        if (!user || !user.isActive) {
            // Session points at a missing/disabled account: drop it.
            await this.sessions.destroy(token);
            throw new UnauthorizedException('Not authenticated');
        }

        request.user = user;
        return true;
    }
}
