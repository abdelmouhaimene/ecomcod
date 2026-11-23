import {
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/shared/current-user.decorator.js';
import { SessionGuard } from '../auth/shared/session.guard.js';
import type { User } from '../users/entities/user.entity.js';
import { CommentsService, type PublicCommentWithDates } from './comments.service.js';
import { CreateCommentDto } from './dto/comment.dto.js';

/** Public testimonials; writes require a verified customer session. */
@Controller({ path: 'comments', version: '1' })
export class PublicCommentsController {
    constructor(private readonly comments: CommentsService) { }

    @Get()
    findAll(): Promise<PublicCommentWithDates[]> {
        return this.comments.findAll();
    }

    @Post()
    @UseGuards(SessionGuard)
    @HttpCode(201)
    create(
        @CurrentUser() user: User,
        @Body() dto: CreateCommentDto,
    ): Promise<PublicCommentWithDates> {
        return this.comments.createForUser(user, dto);
    }
}
