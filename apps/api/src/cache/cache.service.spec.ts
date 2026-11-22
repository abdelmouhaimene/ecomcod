import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service.js';
import { REDIS_CLIENT } from '../redis/redis.module.js';

describe('CacheService', () => {
    let service: CacheService;
    let redis: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(async () => {
        redis = {
            get: vi.fn(async () => null),
            set: vi.fn(async () => 'OK'),
            del: vi.fn(async () => 1),
            scan: vi.fn(async () => ['0', []]),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [CacheService, { provide: REDIS_CLIENT, useValue: redis }],
        }).compile();
        service = module.get<CacheService>(CacheService);
    });

    it('loads, stores and returns uncached values', async () => {
        const loader = vi.fn(async () => ({ count: 3 }));
        await expect(service.getOrSet('cache:test', 60, loader)).resolves.toEqual({ count: 3 });
        expect(redis.set).toHaveBeenCalledWith('cache:test', '{"count":3}', 'EX', 60);
    });

    it('returns cached values without calling the loader', async () => {
        redis.get.mockResolvedValueOnce('{"count":7}');
        const loader = vi.fn(async () => ({ count: 0 }));
        await expect(service.getOrSet('cache:test', 60, loader)).resolves.toEqual({ count: 7 });
        expect(loader).not.toHaveBeenCalled();
    });

    it('fails open when Redis cannot be read', async () => {
        redis.get.mockRejectedValueOnce(new Error('down'));
        const loader = vi.fn(async () => 'fresh');
        await expect(service.getOrSet('cache:test', 60, loader)).resolves.toBe('fresh');
        expect(loader).toHaveBeenCalledOnce();
    });

    it('invalidates unique keys and scans prefixes', async () => {
        await service.invalidate('a', 'b', 'a');
        expect(redis.del).toHaveBeenCalledWith('a', 'b');

        redis.scan.mockResolvedValueOnce(['0', ['cache:offers:1']]);
        await service.invalidatePrefix('cache:offers:');
        expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'cache:offers:*', 'COUNT', 100);
        expect(redis.del).toHaveBeenCalledWith('cache:offers:1');
    });
});
