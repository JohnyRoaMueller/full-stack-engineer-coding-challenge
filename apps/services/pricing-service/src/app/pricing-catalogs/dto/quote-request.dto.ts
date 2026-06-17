import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuoteLineRequestDto {
  @ApiProperty({ example: 'boiler-install' })
  @IsString()
  @Length(1, 64)
  positionKey: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appliedSurchargeKeys?: string[];
}

export class QuoteRequestDto {
  @ApiProperty({ type: [QuoteLineRequestDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineRequestDto)
  lines: QuoteLineRequestDto[];
}
