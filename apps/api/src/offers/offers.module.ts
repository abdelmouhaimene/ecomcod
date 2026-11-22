import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { Product } from '../products/entities/product.entity.js';
import { OffersController } from './offers.controller.js';
import { OffersService } from './offers.service.js';
import { PublicOffersController } from './public-offers.controller.js';
import { OfferPackItem } from './entities/offer-pack-item.entity.js';
import { OfferSingleRule } from './entities/offer-single-rule.entity.js';
import { Offer } from './entities/offer.entity.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Offer, OfferSingleRule, OfferPackItem, Product, Admin]),
        forwardRef(() => SessionModule),
    ],
    controllers: [OffersController, PublicOffersController],
    providers: [OffersService, AdminsService, AdminGuard],
    exports: [OffersService],
})
export class OffersModule {}
