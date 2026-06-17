import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { PricingSchemaInputDto } from './pricing-schema-input.dto';

export class UpdateTradeDto {
  @ApiProperty({ required: false, example: 'Heating & Ventilation' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  displayName?: string;

  @ApiProperty({ required: false, type: PricingSchemaInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PricingSchemaInputDto)
  pricingSchema?: PricingSchemaInputDto;
}
