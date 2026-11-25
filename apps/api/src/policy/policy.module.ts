import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { PolicyController } from './policy.controller.js';
import { PolicyService } from './policy.service.js';
import { PublicPolicyController } from './public-policy.controller.js';
import { PolicyArticle } from './entities/policy-article.entity.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([PolicyArticle, Admin]),
        forwardRef(() => SessionModule),
    ],
    controllers: [PolicyController, PublicPolicyController],
    providers: [PolicyService, AdminsService, AdminGuard],
    exports: [PolicyService],
})
export class PolicyModule { }
