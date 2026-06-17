import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Craftsman } from '../craftsmen/entities/craftsman.entity';
import { CraftsmanTradeAssignment } from '../craftsmen/entities/craftsman-trade-assignment.entity';
import { TradeConfig } from '../trades/entities/trade-config.entity';
import { CatalogDiscount } from './entities/catalog-discount.entity';
import { CatalogPosition } from './entities/catalog-position.entity';
import { PositionSurcharge } from './entities/position-surcharge.entity';
import { PricingCatalogVersion } from './entities/pricing-catalog-version.entity';
import { PricingCatalogsController } from './pricing-catalogs.controller';
import { PricingCatalogsService } from './pricing-catalogs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PricingCatalogVersion,
      CatalogPosition,
      PositionSurcharge,
      CatalogDiscount,
      Craftsman,
      CraftsmanTradeAssignment,
      TradeConfig,
    ]),
  ],
  providers: [PricingCatalogsService],
  controllers: [PricingCatalogsController],
  exports: [PricingCatalogsService],
})
export class PricingCatalogsModule {}
