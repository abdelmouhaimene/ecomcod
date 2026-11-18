import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { Category } from '../categories/entities/category.entity.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';
import { ProductCategory } from './entities/product-category.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { Product } from './entities/product.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category, ProductCategory, ProductImage, ProductVariant, Admin]),
    forwardRef(() => SessionModule),
  ],
  controllers: [ProductsController, UploadController],
  providers: [ProductsService, UploadService, AdminsService, AdminGuard],
  exports: [ProductsService, UploadService],
})
export class ProductsModule {}
