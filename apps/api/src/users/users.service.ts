import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

export type PublicUser = Pick<
    User,
    'id' | 'email' | 'fullName' | 'phoneNumber' | 'isActive' | 'emailVerifiedAt' | 'createdAt'
>;

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
}
