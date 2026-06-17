import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class PositionSurchargeInputDto {
  @ApiProperty({ example: 'rush' })
  @IsString()
  @Length(1, 64)
  key: string;

  @ApiProperty({ example: 'Rush fee' })
  @IsString()
  @Length(1, 255)
  label: string;

  @ApiProperty({ required: false, description: 'Flat amount in cents', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  flatAmount?: number | null;

  @ApiProperty({ required: false, description: 'Decimal fraction e.g. 0.075', nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  @Matches(/^(0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/, {
    message: 'percentageRate must be a decimal fraction between 0 and 1 with up to 6 decimals',
  })
  percentageRate?: string | null;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
