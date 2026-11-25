import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { FaqController } from './faq.controller.js';
import { FaqService } from './faq.service.js';
import { PublicFaqController } from './public-faq.controller.js';
import { FaqItem } from './entities/faq-item.entity.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([FaqItem, Admin]),
        forwardRef(() => SessionModule),
    ],
    controllers: [FaqController, PublicFaqController],
    providers: [FaqService, AdminsService, AdminGuard],
    exports: [FaqService],
})
export class FaqModule { }
