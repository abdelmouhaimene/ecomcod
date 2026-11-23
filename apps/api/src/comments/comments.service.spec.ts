import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { User } from '../users/entities/user.entity.js';
import { CommentsService } from './comments.service.js';
import { Comment } from './entities/comment.entity.js';

const dates = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const verifiedUser = {
    id: 'user-1',
    email: 'collector@example.com',
    fullName: '  Ada Collector  ',
    emailVerifiedAt: new Date('2025-12-01T00:00:00.000Z'),
} as unknown as User;

function comment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: 'comment-1',
        username: 'Ada Collector',
        userImage: null,
        content: 'Beautiful hardware.',
        rating: 5,
        source: 'USER',
        userId: 'user-1',
        ...dates,
        ...overrides,
    } as Comment;
}

describe('CommentsService', () => {
    let service: CommentsService;
    let repo: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(async () => {
        repo = {
            find: vi.fn(async () => [comment()]),
            findOneBy: vi.fn(async () => comment()),
            create: vi.fn((value: Record<string, unknown>) => ({ ...value, ...dates })),
            save: vi.fn(async (value: Record<string, unknown>) => ({ ...value, id: 'comment-1', ...dates })),
            delete: vi.fn(async () => ({ affected: 1 })),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CommentsService,
                { provide: getRepositoryToken(Comment), useValue: repo },
            ],
        }).compile();
        service = module.get(CommentsService);
    });

    it('maps stored comments to the public shape', async () => {
        await expect(service.findAll()).resolves.toEqual([
            expect.objectContaining({
                id: 'comment-1',
                username: 'Ada Collector',
                rating: 5,
                source: 'USER',
            }),
        ]);
    });

    it('creates a user comment from the verified session identity', async () => {
        const result = await service.createForUser(verifiedUser, {
            content: '  Great sound.  ',
            rating: 4,
        });

        expect(result).toMatchObject({
            username: 'Ada Collector',
            content: 'Great sound.',
            rating: 4,
            source: 'USER',
        });
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    });

    it('refuses comments from users without a verified email', async () => {
        const unverified = { ...verifiedUser, emailVerifiedAt: null } as User;
        await expect(
            service.createForUser(unverified, { content: 'Hello there', rating: 5 }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('creates admin fake comments with the manually entered author details', async () => {
        const result = await service.createFake({
            username: '  Julian Vance  ',
            userImage: '/uploads/julian.png',
            content: '  Exceptional finish.  ',
            rating: 5,
        });

        expect(result).toMatchObject({
            username: 'Julian Vance',
            userImage: '/uploads/julian.png',
            content: 'Exceptional finish.',
            source: 'ADMIN',
        });
    });

    it('deletes an existing comment and reports missing ones', async () => {
        await expect(service.remove('comment-1')).resolves.toBeUndefined();
        expect(repo.delete).toHaveBeenCalledWith({ id: 'comment-1' });

        repo.findOneBy.mockResolvedValueOnce(null);
        await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
});
