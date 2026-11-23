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
import { AdminRole, type PublicComment } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { CommentsService, type PublicCommentWithDates } from './comments.service.js';
import { AdminCommentDto } from './dto/comment.dto.js';

/** All active admins can read testimonials; system/manager can create/delete. */
@Controller({ path: 'admin/comments', version: '1' })
@UseGuards(AdminGuard)
export class CommentsController {
    constructor(private readonly comments: CommentsService) { }

    @Get()
    findAll(): Promise<PublicCommentWithDates[]> {
        return this.comments.findAll();
    }

    @Post()
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    create(@Body() dto: AdminCommentDto): Promise<PublicComment<Date>> {
        return this.comments.createFake(dto);
    }

    @Delete(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    @HttpCode(204)
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.comments.remove(id);
    }
}
