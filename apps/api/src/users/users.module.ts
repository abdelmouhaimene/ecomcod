import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { User } from './entities/user.entity.js';
import { forwardRef } from '@nestjs/common';
import { SessionModule } from '../auth/shared/session.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => SessionModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
