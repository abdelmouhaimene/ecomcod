import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { EmailDomainService } from './email-domain.service.js';
import { OtpService } from './otp.service.js';
import { UsersService } from '../users/users.service.js';

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

describe('AuthService', () => {
  let service: AuthService;
  let otp: {
    requestCode: ReturnType<typeof vi.fn>;
    verifyCode: ReturnType<typeof vi.fn>;
  };
  let emailDomain: { hasValidMailServer: ReturnType<typeof vi.fn> };
  let users: {
    findOrCreateByEmail: ReturnType<typeof vi.fn>;
    toPublic: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    otp = {
      requestCode: vi.fn(async () => undefined),
      verifyCode: vi.fn(async () => undefined),
    };
    emailDomain = { hasValidMailServer: vi.fn(async () => true) };
    users = {
      findOrCreateByEmail: vi.fn(async () => ({ id: 'u1', email: 'someone@gmail.com' })),
      toPublic: vi.fn((user: unknown) => user),
    };

    service = new AuthService(
      otp as unknown as OtpService,
      emailDomain as unknown as EmailDomainService,
      users as unknown as UsersService,
    );
  });

  it('rejects a malformed email before requesting a code', async () => {
    const error = await rejected(service.signup({ email: 'not-an-email' }));

    expect(error).toBeInstanceOf(BadRequestException);
    expect(otp.requestCode).not.toHaveBeenCalled();
  });

  it('rejects a domain without a mail server', async () => {
    emailDomain.hasValidMailServer.mockResolvedValueOnce(false);

    const error = await rejected(service.signup({ email: 'someone@gmail.com' }));

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toBe('Please use a valid email address');
    expect(otp.requestCode).not.toHaveBeenCalled();
  });

  it('normalizes the address and requests a code', async () => {
    const result = await service.signup({ email: '  Someone@Gmail.com ' });

    expect(emailDomain.hasValidMailServer).toHaveBeenCalledWith('someone@gmail.com');
    expect(otp.requestCode).toHaveBeenCalledWith('someone@gmail.com');
    expect(result).toEqual({ message: 'Verification code sent to someone@gmail.com' });
  });

  it('verifies the code and returns the public user', async () => {
    const user = { id: 'u1', email: 'someone@gmail.com' };
    users.findOrCreateByEmail.mockResolvedValueOnce(user);
    users.toPublic.mockReturnValueOnce({ id: 'u1', email: 'someone@gmail.com' });

    const result = await service.verifyEmail({
      email: 'someone@gmail.com',
      code: '123456',
    });

    expect(otp.verifyCode).toHaveBeenCalledWith('someone@gmail.com', '123456');
    expect(users.findOrCreateByEmail).toHaveBeenCalledWith('someone@gmail.com');
    expect(users.toPublic).toHaveBeenCalledWith(user);
    expect(result).toEqual({
      verified: true,
      user: { id: 'u1', email: 'someone@gmail.com' },
    });
  });
});
