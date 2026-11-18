import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { UsersController } from './users.controller.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Admin]), forwardRef(() => SessionModule)],
  controllers: [UsersController],
  providers: [UsersService, AdminsService, AdminGuard],
  exports: [UsersService],
})
export class UsersModule { }
