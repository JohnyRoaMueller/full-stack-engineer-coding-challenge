import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { dataSourceOptions } from '../data-source';
import { AuthModule } from './auth/auth.module';
import { CraftsmenModule } from './craftsmen/craftsmen.module';
import { TradesModule } from './trades/trades.module';
import { PricingCatalogsModule } from './pricing-catalogs/pricing-catalogs.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: false,
    }),
    AuthModule,
    CraftsmenModule,
    TradesModule,
    PricingCatalogsModule,
    HealthModule,
  ],
})
export class AppModule {}
