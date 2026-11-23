import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../admins/entities/admin.entity.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { SessionModule } from '../auth/shared/session.module.js';
import { ProductCategory } from '../products/entities/product-category.entity.js';
import { CategoriesController } from './categories.controller.js';
import { PublicCategoriesController } from './public-categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { Category } from './entities/category.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, ProductCategory, Admin]),
    forwardRef(() => SessionModule),
  ],
  controllers: [CategoriesController, PublicCategoriesController],
  providers: [CategoriesService, AdminsService, AdminGuard],
  exports: [CategoriesService],
})
export class CategoriesModule {}
