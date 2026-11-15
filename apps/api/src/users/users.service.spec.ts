import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repo = {
      findOne: vi.fn(async () => null),
      create: vi.fn((value: unknown) => value),
      save: vi.fn(async (value: unknown) => ({
        ...(value as object),
        id: 'generated-id',
        isActive: true,
        createdAt: new Date(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a verified user with a normalized email', async () => {
    const result = await service.findOrCreateByEmail('  User@Example.com ');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
    expect(repo.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      emailVerifiedAt: expect.any(Date),
    });
    expect(result.id).toBe('generated-id');
  });

  it('returns an existing verified user without saving', async () => {
    const existing = {
      id: 'u1',
      email: 'user@example.com',
      emailVerifiedAt: new Date('2024-01-01'),
    } as User;
    repo.findOne.mockResolvedValueOnce(existing);

    const result = await service.findOrCreateByEmail('user@example.com');

    expect(result).toBe(existing);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('marks an existing unverified user as verified', async () => {
    const existing = {
      id: 'u1',
      email: 'user@example.com',
      emailVerifiedAt: null,
    } as User;
    repo.findOne.mockResolvedValueOnce(existing);

    const result = await service.findOrCreateByEmail('user@example.com');

    expect(result.emailVerifiedAt).toBeInstanceOf(Date);
    expect(repo.save).toHaveBeenCalledWith(existing);
  });

  it('recovers the existing row on a unique-index race', async () => {
    const raced = {
      id: 'u2',
      email: 'user@example.com',
    } as User;
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(raced);
    repo.save.mockRejectedValueOnce({ code: '23505' });

    const result = await service.findOrCreateByEmail('user@example.com');

    expect(result).toBe(raced);
  });

  describe('findOrCreateByGoogle', () => {
    const identity = {
      googleId: 'google-1',
      email: '  User@Example.com ',
      fullName: 'Jane Doe',
      emailVerified: true,
    };

    it('returns an already linked account without touching the email lookup', async () => {
      const linked = { id: 'u1', email: 'user@example.com', googleId: 'google-1' } as User;
      repo.findOne.mockResolvedValueOnce(linked);

      const result = await service.findOrCreateByGoogle(identity);

      expect(result).toBe(linked);
      expect(repo.findOne).toHaveBeenCalledTimes(1);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { googleId: 'google-1' } });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('links Google to an existing account with the same email', async () => {
      const existing = {
        id: 'u1',
        email: 'user@example.com',
        fullName: null,
        googleId: null,
        emailVerifiedAt: null,
      } as User;
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);

      const result = await service.findOrCreateByGoogle(identity);

      expect(result.googleId).toBe('google-1');
      expect(result.fullName).toBe('Jane Doe');
      expect(result.emailVerifiedAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalledWith(existing);
    });

    it('keeps the existing profile data when linking', async () => {
      const existing = {
        id: 'u1',
        email: 'user@example.com',
        fullName: 'Existing Name',
        googleId: null,
        emailVerifiedAt: new Date('2024-01-01'),
      } as User;
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);

      const result = await service.findOrCreateByGoogle(identity);

      expect(result.fullName).toBe('Existing Name');
      expect(result.emailVerifiedAt).toEqual(new Date('2024-01-01'));
    });

    it('creates a verified account for a new Google user', async () => {
      const result = await service.findOrCreateByGoogle(identity);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { googleId: 'google-1' } });
      expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
      expect(repo.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        googleId: 'google-1',
        fullName: 'Jane Doe',
        emailVerifiedAt: expect.any(Date),
      });
      expect(result.id).toBe('generated-id');
    });

    it('does not mark the email verified when Google says it is not', async () => {
      await service.findOrCreateByGoogle({ ...identity, emailVerified: false });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerifiedAt: null }),
      );
    });

    it('recovers the existing row when two callbacks race', async () => {
      const raced = { id: 'u2', email: 'user@example.com', googleId: 'google-1' } as User;
      repo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(raced);
      repo.save.mockRejectedValueOnce({ code: '23505' });

      const result = await service.findOrCreateByGoogle(identity);

      expect(result).toBe(raced);
    });
  });

  it('never exposes the password in the public shape', () => {
    const emailVerifiedAt = new Date('2024-01-01');
    const createdAt = new Date('2024-01-02');
    const user = {
      id: 'u1',
      email: 'user@example.com',
      fullName: null,
      phoneNumber: null,
      password: 'super-secret',
      isActive: true,
      emailVerifiedAt,
      createdAt,
    } as User;

    const publicUser = service.toPublic(user);

    expect(publicUser).not.toHaveProperty('password');
    expect(publicUser).toEqual({
      id: 'u1',
      email: 'user@example.com',
      fullName: null,
      phoneNumber: null,
      isActive: true,
      emailVerifiedAt,
      createdAt,
    });
  });
});
