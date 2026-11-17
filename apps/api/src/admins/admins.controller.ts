import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminsService } from './admins.service.js';
import { AdminRole, type PublicAdmin } from '@repo/types';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { AdminGuard } from './guards/admin.guard.js';
import { Roles } from './decorators/roles.decorator.js';

/** Admin management is reserved for the single system admin. */
@Controller({ path: 'admin/admins', version: '1' })
@UseGuards(AdminGuard)
@Roles(AdminRole.SYSTEM)
export class AdminsController {
  constructor(private readonly admins: AdminsService) { }

  @Get()
  async list(): Promise<PublicAdmin<Date>[]> {
    const admins = await this.admins.findAll();
    return admins.map((admin) => this.admins.toPublic(admin));
  }

  @Post()
  create(@Body() dto: CreateAdminDto): Promise<PublicAdmin<Date>> {
    return this.admins.create(dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.admins.remove(id);
  }
}
