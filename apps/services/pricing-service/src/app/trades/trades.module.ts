import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogPosition } from '../pricing-catalogs/entities/catalog-position.entity';
import { TradeConfig } from './entities/trade-config.entity';
import { TradesService } from './trades.service';
import { TradesController } from './trades.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TradeConfig, CatalogPosition])],
  providers: [TradesService],
  controllers: [TradesController],
  exports: [TradesService],
})
export class TradesModule {}
