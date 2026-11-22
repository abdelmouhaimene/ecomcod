import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { Category } from '../categories/entities/category.entity.js';
import { Family } from '../families/entities/family.entity.js';
import { OrderItem } from '../orders/entities/order-item.entity.js';
import { StockMovement } from '../stock/entities/stock-movement.entity.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { PublicProductsController } from './public-products.controller.js';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';
import { ProductCategory } from './entities/product-category.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductSku } from './entities/product-sku.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { ProductVariantValue } from './entities/product-variant-value.entity.js';
import { Product } from './entities/product.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      Family,
      ProductCategory,
      ProductImage,
      ProductVariant,
      ProductVariantValue,
      ProductSku,
      StockMovement,
      OrderItem,
      Admin,
    ]),
    forwardRef(() => SessionModule),
  ],
  controllers: [ProductsController, PublicProductsController, UploadController],
  providers: [ProductsService, UploadService, AdminsService, AdminGuard],
  exports: [ProductsService, UploadService],
})
export class ProductsModule {}
