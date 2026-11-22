import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service.js';
import { LockService } from './lock.service.js';

@Global()
@Module({
    providers: [CacheService, LockService],
    exports: [CacheService, LockService],
})
export class CacheModule {}
