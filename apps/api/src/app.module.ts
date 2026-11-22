import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CacheModule } from './cache/cache.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AdminsModule } from './admins/admins.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { FamiliesModule } from './families/families.module.js';
import { ProductsModule } from './products/products.module.js';
import { StockModule } from './stock/stock.module.js';
import { OffersModule } from './offers/offers.module.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    CacheModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AdminsModule,
    CategoriesModule,
    FamiliesModule,
    ProductsModule,
    StockModule,
    OffersModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
