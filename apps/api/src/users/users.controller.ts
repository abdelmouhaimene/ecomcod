import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { SessionGuard } from '../auth/shared/session.guard.js';

@Controller({ path: 'users', version: '1' })
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    // @UseGuards(SessionGuard)
    async findAll() {
        const users = await this.usersService.findAll();
        return users
    }
}