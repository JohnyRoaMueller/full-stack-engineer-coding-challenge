import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, ValidateNested } from 'class-validator';
import { CatalogDiscountInputDto } from './catalog-discount-input.dto';
import { CatalogPositionInputDto } from './catalog-position-input.dto';

export class UpdatePricingCatalogDto {
  @ApiProperty({ required: false, type: [CatalogPositionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogPositionInputDto)
  positions?: CatalogPositionInputDto[];

  @ApiProperty({ required: false, type: [CatalogDiscountInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogDiscountInputDto)
  discounts?: CatalogDiscountInputDto[];

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;
}
