import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CreateCatalog1794883200000 } from './migrations/1794883200000-CreateCatalog.js';
import { CreateStock1794973200000 } from './migrations/1794973200000-CreateStock.js';
import { CreateVariantSkusAndMovements1795065600000 } from './migrations/1795065600000-CreateVariantSkusAndMovements.js';
import { CreateFamiliesOffersOrders1795152000000 } from './migrations/1795152000000-CreateFamiliesOffersOrders.js';
import { ReshapeVariantsAndStockEntries1795248000000 } from './migrations/1795248000000-ReshapeVariantsAndStockEntries.js';
import { ProductScopedOffers1795324400000 } from './migrations/1795324400000-ProductScopedOffers.js';
import { SupplierContacts1795410000000 } from './migrations/1795410000000-SupplierContacts.js';
import { CategoryIcon1795410800000 } from './migrations/1795410800000-CategoryIcon.js';
import { CreateComments1795411600000 } from './migrations/1795411600000-CreateComments.js';
import { CreateGallery1795412400000 } from './migrations/1795412400000-CreateGallery.js';
import { CreateStore1795413200000 } from './migrations/1795413200000-CreateStore.js';
import { AddOrderDeliveryDetails1795464000000 } from './migrations/1795464000000-AddOrderDeliveryDetails.js';
import { AddUserProfileLocation1795465000000 } from './migrations/1795465000000-AddUserProfileLocation.js';
import { CreateFaqAndPolicy1795550000000 } from './migrations/1795550000000-CreateFaqAndPolicy.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';

        // Migrations are idempotent (IF NOT EXISTS / DO blocks) and run before
        // synchronize. Running them in every environment makes sure existing
        // development data is backfilled (e.g. stock lines get a DEFAULT SKU)
        // before TypeORM applies new NOT NULL columns.
        const migrations = [
          CreateCatalog1794883200000,
          CreateStock1794973200000,
          CreateVariantSkusAndMovements1795065600000,
          CreateFamiliesOffersOrders1795152000000,
          ReshapeVariantsAndStockEntries1795248000000,
          ProductScopedOffers1795324400000,
          SupplierContacts1795410000000,
          CategoryIcon1795410800000,
          CreateComments1795411600000,
          CreateGallery1795412400000,
          CreateStore1795413200000,
          AddOrderDeliveryDetails1795464000000,
          AddUserProfileLocation1795465000000,
          CreateFaqAndPolicy1795550000000,
        ];

        return {
          type: 'postgres',
          host: configService.get<string>('DATABASE_HOST'),
          port: configService.get<number>('DATABASE_PORT'),
          username: configService.get<string>('DATABASE_USER'),
          password: configService.get<string>('DATABASE_PASSWORD'),
          database: configService.get<string>('DATABASE_NAME'),
          autoLoadEntities: true,
          // WARNING: synchronize should be false in production, using migrations instead
          synchronize: !isProduction,
          migrations,
          migrationsRun: true,
          ssl: isProduction ? { rejectUnauthorized: false } : false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
