import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { UsersModule } from '../users/users.module.js';
import { CommentsController } from './comments.controller.js';
import { PublicCommentsController } from './public-comments.controller.js';
import { CommentsService } from './comments.service.js';
import { Comment } from './entities/comment.entity.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Comment, Admin]),
        forwardRef(() => SessionModule),
        forwardRef(() => UsersModule),
    ],
    controllers: [CommentsController, PublicCommentsController],
    providers: [CommentsService, AdminsService, AdminGuard],
    exports: [CommentsService],
})
export class CommentsModule { }
