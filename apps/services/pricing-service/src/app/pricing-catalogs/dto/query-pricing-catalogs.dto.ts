import { ApiProperty } from '@nestjs/swagger';
import { TRADE_CODES, TradeCode } from '@sandbox/types';
import { IsIn, Matches } from 'class-validator';

/** Accepts UUID-shaped ids including the deterministic sandbox partner craftsman id. */
const CRAFTSMAN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class QueryPricingCatalogsDto {
  @ApiProperty({ format: 'uuid' })
  @Matches(CRAFTSMAN_ID_PATTERN, { message: 'craftsmanId must be a UUID' })
  craftsmanId: string;

  @ApiProperty({ enum: TRADE_CODES, example: 'HVAC' })
  @IsIn(TRADE_CODES)
  trade: TradeCode;
}
