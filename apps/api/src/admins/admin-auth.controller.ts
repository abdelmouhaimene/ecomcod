import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminLoginResponse,
  MessageResponse,
  PublicAdmin,
} from '@repo/types';
import type { Request, Response } from 'express';
import { AdminsService } from './admins.service.js';
import { AdminLoginDto } from './dto/admin-login.dto.js';
import { ChangeAdminPasswordDto } from './dto/change-admin-password.dto.js';
import { AdminGuard } from './guards/admin.guard.js';
import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { ADMIN_SESSION_COOKIE, SessionService } from '../auth/shared/session.service.js';
import type { Admin } from './entities/admin.entity.js';

@Controller({ path: 'admin/auth', version: '1' })
export class AdminAuthController {
  constructor(
    private readonly admins: AdminsService,
    private readonly sessions: SessionService,
  ) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminLoginResponse<Date>> {
    const admin = await this.admins.verifyLogin(dto.username, dto.password);
    const session = await this.sessions.createForAdmin(admin.id, dto.rememberMe === true);
    res.cookie(ADMIN_SESSION_COOKIE, session.token, this.sessions.cookieFor(session));
    return { admin: this.admins.toPublic(admin) };
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@CurrentAdmin() admin: Admin): PublicAdmin<Date> {
    return this.admins.toPublic(admin);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  async changePassword(
    @CurrentAdmin() admin: Admin,
    @Body() dto: ChangeAdminPasswordDto,
  ): Promise<MessageResponse> {
    await this.admins.changePassword(admin.id, dto);
    return { message: 'Password updated successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
    await this.sessions.destroy(token);
    res.clearCookie(ADMIN_SESSION_COOKIE, this.sessions.cookieOptions);
  }
}
