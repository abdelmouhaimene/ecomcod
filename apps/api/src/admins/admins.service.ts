import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdminRole,
  type ChangeAdminPasswordPayload,
  type CreateAdminPayload,
  type PublicAdmin as PublicAdminShape,
} from '@repo/types';
import { Admin } from './entities/admin.entity.js';
import { hashPassword, verifyPassword } from '../auth/shared/password.js';

/** Shared wire contract, with real Dates while inside the API. */
export type PublicAdmin = PublicAdminShape<Date>;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin) private readonly repo: Repository<Admin>,
  ) { }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  toPublic(admin: Admin): PublicAdmin {
    return {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  findById(id: string): Promise<Admin | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByUsername(username: string): Promise<Admin | null> {
    return this.repo.findOne({ where: { username: this.normalizeUsername(username) } });
  }

  findAll(): Promise<Admin[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  /**
   * Creates the one system admin on first boot. Calling this again is a no-op,
   * so it is safe to run on every application start.
   */
  async seedSystemAdmin(username: string, password: string): Promise<boolean> {
    const existing = await this.repo.findOne({ where: { role: AdminRole.SYSTEM } });
    if (existing) return false;

    try {
      const admin = this.repo.create({
        username: this.normalizeUsername(username),
        password: await hashPassword(password),
        role: AdminRole.SYSTEM,
        isActive: true,
      });
      await this.repo.save(admin);
      return true;
    } catch (error) {
      // A concurrent instance may have won the race; the partial unique index
      // still guarantees a single system admin.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  /** Validates admin credentials and records the login. */
  async verifyLogin(username: string, password: string): Promise<Admin> {
    const admin = await this.repo.findOne({
      where: { username: this.normalizeUsername(username) },
      select: {
        id: true,
        username: true,
        password: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin || !(await verifyPassword(password, admin.password))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (!admin.isActive) {
      throw new UnauthorizedException('This account has been disabled');
    }

    admin.lastLoginAt = new Date();
    await this.repo.save(admin);
    return admin;
  }

  /** System admin only: creates a manager or an agent. */
  async create(dto: CreateAdminPayload): Promise<PublicAdmin> {
    if (dto.role === AdminRole.SYSTEM) {
      throw new BadRequestException('The system admin already exists and cannot be created.');
    }

    const username = this.normalizeUsername(dto.username);
    if (await this.findByUsername(username)) {
      throw new ConflictException('This username is already in use.');
    }

    try {
      const admin = this.repo.create({
        username,
        password: await hashPassword(dto.password),
        role: dto.role,
        isActive: true,
      });
      await this.repo.save(admin);
      return this.toPublic(admin);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This username is already in use.');
      }
      throw error;
    }
  }

  /** System admin only: the seeded account is protected from deletion. */
  async remove(id: string): Promise<void> {
    const admin = await this.findById(id);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }
    if (admin.role === AdminRole.SYSTEM) {
      throw new ForbiddenException('The system admin cannot be deleted.');
    }
    await this.repo.delete({ id: admin.id });
  }

  async changePassword(id: string, dto: ChangeAdminPasswordPayload): Promise<void> {
    const admin = await this.repo.findOne({
      where: { id },
      select: { id: true, password: true },
    });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (!(await verifyPassword(dto.currentPassword, admin.password))) {
      throw new BadRequestException('Current password is incorrect');
    }

    admin.password = await hashPassword(dto.newPassword);
    await this.repo.save(admin);
  }
}
