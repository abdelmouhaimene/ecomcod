import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminRole } from '@repo/types';
import { Admin } from './entities/admin.entity.js';
import { AdminsService } from './admins.service.js';
import { hashPassword, verifyPassword } from '../auth/shared/password.js';

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

describe('AdminsService', () => {
  let service: AdminsService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repo = {
      findOne: vi.fn(async () => null),
      create: vi.fn((value: unknown) => value),
      save: vi.fn(async (value: unknown) => value),
      delete: vi.fn(async () => ({ affected: 1 })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminsService,
        { provide: getRepositoryToken(Admin), useValue: repo },
      ],
    }).compile();

    service = module.get<AdminsService>(AdminsService);
  });

  it('never exposes the password hash', () => {
    const publicAdmin = service.toPublic({
      id: 'a1',
      username: 'admin',
      password: 'secret-hash',
      role: AdminRole.SYSTEM,
    } as Admin);

    expect(publicAdmin).not.toHaveProperty('password');
    expect(publicAdmin.role).toBe(AdminRole.SYSTEM);
  });

  describe('seedSystemAdmin', () => {
    it('creates one hashed system admin with a normalized username', async () => {
      await expect(service.seedSystemAdmin(' Admin ', 'admin')).resolves.toBe(true);

      expect(repo.create).toHaveBeenCalledWith({
        username: 'admin',
        password: expect.stringMatching(/^[0-9a-f]+:[0-9a-f]+$/),
        role: AdminRole.SYSTEM,
        isActive: true,
      });
      const hash = repo.create.mock.calls[0][0].password as string;
      expect(hash).not.toContain('admin');
      await expect(verifyPassword('admin', hash)).resolves.toBe(true);
    });

    it('is a no-op when a system admin already exists', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'a1', role: AdminRole.SYSTEM });

      await expect(service.seedSystemAdmin('admin', 'admin')).resolves.toBe(false);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('ignores a concurrent seed that lost the unique-index race', async () => {
      repo.save.mockRejectedValueOnce({ code: '23505' });

      await expect(service.seedSystemAdmin('admin', 'admin')).resolves.toBe(false);
    });

    it('propagates other database errors', async () => {
      repo.save.mockRejectedValueOnce(new Error('db down'));

      await expect(service.seedSystemAdmin('admin', 'admin')).rejects.toThrow('db down');
    });
  });

  describe('verifyLogin', () => {
    it('accepts the correct password and records the login', async () => {
      const hash = await hashPassword('secret123');
      const admin = { id: 'a1', username: 'admin', password: hash, isActive: true } as Admin;
      repo.findOne.mockResolvedValueOnce(admin);

      const result = await service.verifyLogin(' ADMIN ', 'secret123');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { username: 'admin' },
        select: expect.objectContaining({ password: true }),
      });
      expect(result.lastLoginAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalledWith(admin);
    });

    it('rejects an unknown admin or a wrong password', async () => {
      const unknown = await rejected(service.verifyLogin('nobody', 'secret123'));
      expect(unknown).toBeInstanceOf(UnauthorizedException);

      repo.findOne.mockResolvedValueOnce({
        id: 'a1',
        password: await hashPassword('secret123'),
        isActive: true,
      });
      const wrong = await rejected(service.verifyLogin('admin', 'wrong'));
      expect(wrong).toBeInstanceOf(UnauthorizedException);
      expect((wrong as Error).message).toBe('Invalid username or password');
    });

    it('refuses a disabled admin', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'a1',
        password: await hashPassword('secret123'),
        isActive: false,
      });

      const error = await rejected(service.verifyLogin('admin', 'secret123'));
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as Error).message).toContain('disabled');
    });
  });

  describe('create', () => {
    it('refuses to create a second system admin', async () => {
      const error = await rejected(service.create({
        username: 'root',
        password: 'secret123',
        role: AdminRole.SYSTEM,
      }));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('hashes the password and normalizes the username', async () => {
      const result = await service.create({
        username: '  Manager.One ',
        password: 'secret123',
        role: AdminRole.MANAGER,
      });

      expect(repo.create).toHaveBeenCalledWith({
        username: 'manager.one',
        password: expect.stringMatching(/^[0-9a-f]+:[0-9a-f]+$/),
        role: AdminRole.MANAGER,
        isActive: true,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('rejects a duplicate username', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'a1', username: 'manager.one' });

      const error = await rejected(service.create({
        username: 'Manager.One',
        password: 'secret123',
        role: AdminRole.AGENT,
      }));

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toBe('This username is already in use.');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('maps a unique-index race to a conflict', async () => {
      repo.save.mockRejectedValueOnce({ code: '23505' });

      const error = await rejected(service.create({
        username: 'agent.one',
        password: 'secret123',
        role: AdminRole.AGENT,
      }));
      expect(error).toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('refuses to delete the system admin', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'a1', role: AdminRole.SYSTEM });

      const error = await rejected(service.remove('a1'));
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as Error).message).toBe('The system admin cannot be deleted.');
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes a manager or agent', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'a2', role: AdminRole.AGENT });

      await service.remove('a2');
      expect(repo.delete).toHaveBeenCalledWith({ id: 'a2' });
    });

    it('reports a missing admin', async () => {
      const error = await rejected(service.remove('missing'));
      expect(error).toBeInstanceOf(NotFoundException);
    });
  });

  describe('changePassword', () => {
    it('requires the current password and hashes the new one', async () => {
      const hash = await hashPassword('secret123');
      const admin = { id: 'a1', password: hash } as Admin;
      repo.findOne.mockResolvedValueOnce(admin);

      const wrong = await rejected(service.changePassword('a1', {
        currentPassword: 'nope',
        newPassword: 'newsecret456',
      }));
      expect(wrong).toBeInstanceOf(BadRequestException);
      expect((wrong as Error).message).toBe('Current password is incorrect');

      repo.findOne.mockResolvedValueOnce(admin);
      await service.changePassword('a1', {
        currentPassword: 'secret123',
        newPassword: 'newsecret456',
      });
      expect(admin.password).not.toBe(hash);
      await expect(verifyPassword('newsecret456', admin.password)).resolves.toBe(true);
    });
  });
});
