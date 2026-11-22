import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { Offer } from '../offers/entities/offer.entity.js';
import { ProductSku } from '../products/entities/product-sku.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { StockMovement } from '../stock/entities/stock-movement.entity.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PosController } from './pos.controller.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from './entities/order.entity.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Order, OrderItem, Offer, ProductSku, Product, StockMovement, Admin]),
        forwardRef(() => SessionModule),
    ],
    controllers: [OrdersController, PosController],
    providers: [OrdersService, AdminsService, AdminGuard],
    exports: [OrdersService],
})
export class OrdersModule {}
