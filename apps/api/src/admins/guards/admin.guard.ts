import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService, ADMIN_SESSION_COOKIE } from '../../auth/shared/session.service.js';
import { AdminsService } from '../admins.service.js';
import { ADMIN_ROLES_KEY } from '../decorators/roles.decorator.js';
import { AdminRole } from '@repo/types';
import type { Admin } from '../entities/admin.entity.js';

export interface RequestWithAdmin extends Request {
  admin?: Admin;
}

/** Authenticates the admin cookie and enforces @Roles(...). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly admins: AdminsService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const token = request.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;

    const adminId = await this.sessions.getAdminId(token);
    if (!adminId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const admin = await this.admins.findById(adminId);
    if (!admin || !admin.isActive) {
      await this.sessions.destroy(token);
      throw new UnauthorizedException('Not authenticated');
    }

    const allowed = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed?.length && !allowed.includes(admin.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    request.admin = admin;
    return true;
  }
}
