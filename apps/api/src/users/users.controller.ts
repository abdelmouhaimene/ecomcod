import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PublicUser } from '@repo/types';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { UsersService } from './users.service.js';

/** Customer records are staff-only; the public shape never exposes credentials. */
@Controller({ path: 'users', version: '1' })
@UseGuards(AdminGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    async findAll(): Promise<PublicUser<Date>[]> {
        const users = await this.usersService.findAll();
        return users.map((user) => this.usersService.toPublic(user));
    }
}
