import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

export type PublicUser = Pick<
    User,
    'id' | 'email' | 'fullName' | 'phoneNumber' | 'isActive' | 'emailVerifiedAt' | 'createdAt'
>;

/** Shape returned by GET /auth/me: public data plus the auth capabilities. */
export interface MeUser extends PublicUser {
    hasPassword: boolean;
}

/** Subset of Google's userinfo response we rely on. */
export interface GoogleIdentity {
    googleId: string;
    email: string;
    fullName: string | null;
    emailVerified: boolean;
}

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly users: Repository<User>,
    ) { }

    async findById(id: string): Promise<User | null> {
        return this.users.findOne({ where: { id } });
    }

    async findAll(): Promise<User[]> {
        return this.users.find({ order: { createdAt: 'DESC' } });
    }

    async findByIdWithPassword(id: string): Promise<User | null> {
        return this.users.findOne({
            where: { id },
            select: {
                id: true,
                fullName: true,
                phoneNumber: true,
                email: true,
                googleId: true,
                password: true,
                emailVerifiedAt: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });
    }

    async findByEmail(rawEmail: string): Promise<User | null> {
        const email = rawEmail.trim().toLowerCase();
        // `password` is `select: false` by default, so request it explicitly.
        return this.users.findOne({
            where: { email },
            select: {
                id: true,
                fullName: true,
                phoneNumber: true,
                email: true,
                googleId: true,
                password: true,
                emailVerifiedAt: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });
    }

    /**
     * Creates a real (password-backed) account. Only call this once the email
     * has been verified and a password has been chosen.
     */
    async createWithPassword(
        rawEmail: string,
        passwordHash: string,
        fullName: string | null = null,
    ): Promise<User> {
        const email = rawEmail.trim().toLowerCase();
        const user = this.users.create({ email, password: passwordHash, fullName, emailVerifiedAt: new Date() });

        try {
            return await this.users.save(user);
        } catch (error) {
            if ((error as { code?: string }).code === '23505') {
                const raced = await this.users.findOne({ where: { email } });
                if (raced) return raced;
            }
            throw error;
        }
    }

    /**
     * Returns the user matching the email, creating it (email verified) the
     * first time the address completes the OTP flow.
     */
    async findOrCreateByEmail(rawEmail: string): Promise<User> {
        const email = rawEmail.trim().toLowerCase();

        const existing = await this.users.findOne({ where: { email } });
        if (existing) {
            if (!existing.emailVerifiedAt) {
                existing.emailVerifiedAt = new Date();
                return this.users.save(existing);
            }
            return existing;
        }

        const user = this.users.create({ email, emailVerifiedAt: new Date() });

        try {
            return await this.users.save(user);
        } catch (error) {
            // Two verifications raced; the unique index kept only one row.
            if ((error as { code?: string }).code === '23505') {
                const raced = await this.users.findOne({ where: { email } });
                if (raced) return raced;
            }
            throw error;
        }
    }

    /**
     * Resolves the account behind a Google sign-in:
     * 1. already linked -> return it;
     * 2. same verified email from the OTP flow -> link Google to it;
     * 3. otherwise create a new, already-verified account.
     */
    async findOrCreateByGoogle(identity: GoogleIdentity): Promise<User> {
        const email = identity.email.trim().toLowerCase();

        const linked = await this.users.findOne({ where: { googleId: identity.googleId } });
        if (linked) return linked;

        const byEmail = await this.users.findOne({ where: { email } });
        if (byEmail) {
            byEmail.googleId = identity.googleId;
            if (!byEmail.emailVerifiedAt && identity.emailVerified) {
                byEmail.emailVerifiedAt = new Date();
            }
            if (!byEmail.fullName && identity.fullName) {
                byEmail.fullName = identity.fullName;
            }
            return this.users.save(byEmail);
        }

        const user = this.users.create({
            email,
            googleId: identity.googleId,
            fullName: identity.fullName,
            emailVerifiedAt: identity.emailVerified ? new Date() : null,
        });

        try {
            return await this.users.save(user);
        } catch (error) {
            // Two callbacks raced; the unique indexes kept only one row.
            if ((error as { code?: string }).code === '23505') {
                const raced =
                    (await this.users.findOne({ where: { googleId: identity.googleId } })) ??
                    (await this.users.findOne({ where: { email } }));
                if (raced) return raced;
            }
            throw error;
        }
    }

    /** Persists mutable fields (e.g. lastLoginAt) for an existing user. */
    async save(user: User): Promise<User> {
        return this.users.save(user);
    }

    /** Strips fields that must never leave the API (e.g. password). */
    toPublic(user: User): PublicUser {
        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            isActive: user.isActive,
            emailVerifiedAt: user.emailVerifiedAt,
            createdAt: user.createdAt,
        };
    }

    /** Public data for the account owner, including auth capabilities. */
    toMe(user: User): MeUser {
        return { ...this.toPublic(user), hasPassword: Boolean(user.password) };
    }
}
