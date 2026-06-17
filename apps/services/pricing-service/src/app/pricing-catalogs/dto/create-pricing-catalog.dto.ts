import { ApiProperty } from '@nestjs/swagger';
import { TRADE_CODES, TradeCode } from '@sandbox/types';
import { IsIn, IsUUID } from 'class-validator';

export class CreatePricingCatalogDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  craftsmanId: string;

  @ApiProperty({ enum: TRADE_CODES, example: 'HVAC' })
  @IsIn(TRADE_CODES)
  trade: TradeCode;
}
