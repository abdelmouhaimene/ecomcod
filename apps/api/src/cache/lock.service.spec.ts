import { Test, TestingModule } from '@nestjs/testing';
import { LockService } from './lock.service.js';
import { REDIS_CLIENT } from '../redis/redis.module.js';

describe('LockService', () => {
    let service: LockService;
    let redis: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(async () => {
        redis = {
            set: vi.fn(async () => 'OK'),
            eval: vi.fn(async () => 1),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [LockService, { provide: REDIS_CLIENT, useValue: redis }],
        }).compile();
        service = module.get<LockService>(LockService);
    });

    it('acquires a lock and releases it exactly once', async () => {
        const lock = await service.acquire('lock:checkout:1');
        expect(lock).not.toBeNull();
        expect(redis.set).toHaveBeenCalledWith(
            'lock:checkout:1',
            expect.any(String),
            'EX',
            10,
            'NX',
        );

        await lock?.release();
        await lock?.release();
        expect(redis.eval).toHaveBeenCalledOnce();
        expect(redis.eval.mock.calls[0][0]).toContain("redis.call('get', KEYS[1])");
    });

    it('returns null when the lock is already held', async () => {
        redis.set.mockResolvedValueOnce(null);
        await expect(service.acquire('lock:checkout:1')).resolves.toBeNull();
        expect(redis.eval).not.toHaveBeenCalled();
    });

    it('fails open when Redis is unavailable', async () => {
        redis.set.mockRejectedValueOnce(new Error('down'));
        await expect(service.acquire('lock:checkout:1')).resolves.toBeNull();
    });
});
