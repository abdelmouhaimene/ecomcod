import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { Product } from '../products/entities/product.entity.js';
import { StockEntryItem } from './entities/stock-entry-item.entity.js';
import { StockEntry } from './entities/stock-entry.entity.js';
import { Supplier } from './entities/supplier.entity.js';
import { StockEntriesController } from './stock-entries.controller.js';
import { StockEntriesService } from './stock-entries.service.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Supplier, StockEntry, StockEntryItem, Product, Admin]),
        forwardRef(() => SessionModule),
    ],
    controllers: [SuppliersController, StockEntriesController],
    providers: [SuppliersService, StockEntriesService, AdminsService, AdminGuard],
    exports: [SuppliersService, StockEntriesService],
})
export class StockModule {}
