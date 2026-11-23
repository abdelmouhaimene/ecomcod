import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PublicComment } from '@repo/types';
import { Repository } from 'typeorm';
import type { User } from '../users/entities/user.entity.js';
import { AdminCommentDto, CreateCommentDto } from './dto/comment.dto.js';
import { Comment } from './entities/comment.entity.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicCommentWithDates = PublicComment<Date>;

@Injectable()
export class CommentsService {
    constructor(
        @InjectRepository(Comment) private readonly repo: Repository<Comment>,
    ) { }

    toPublic(comment: Comment): PublicCommentWithDates {
        return {
            id: comment.id,
            username: comment.username,
            userImage: comment.userImage ?? null,
            content: comment.content,
            rating: comment.rating,
            source: comment.source,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
        };
    }

    async findAll(): Promise<PublicCommentWithDates[]> {
        const comments = await this.repo.find({ order: { createdAt: 'DESC' } });
        return comments.map((comment) => this.toPublic(comment));
    }

    /** Only email-verified accounts may post; the name is a snapshot, not a relation. */
    async createForUser(
        user: User,
        dto: CreateCommentDto,
    ): Promise<PublicCommentWithDates> {
        if (!user.emailVerifiedAt) {
            throw new ForbiddenException('Only verified users can post comments.');
        }

        const username = user.fullName?.trim() || user.email.split('@')[0];
        const comment = this.repo.create({
            username,
            userImage: null,
            content: dto.content.trim(),
            rating: dto.rating,
            source: 'USER',
            userId: user.id,
        });
        await this.repo.save(comment);
        return this.toPublic(comment);
    }

    async createFake(dto: AdminCommentDto): Promise<PublicCommentWithDates> {
        const comment = this.repo.create({
            username: dto.username.trim(),
            userImage: dto.userImage ?? null,
            content: dto.content.trim(),
            rating: dto.rating,
            source: 'ADMIN',
            userId: null,
        });
        await this.repo.save(comment);
        return this.toPublic(comment);
    }

    async remove(id: string): Promise<void> {
        const comment = await this.repo.findOneBy({ id });
        if (!comment) throw new NotFoundException('Comment not found');
        await this.repo.delete({ id });
    }
}
