import { ApiProperty } from '@nestjs/swagger';
import { QuoteResult } from '../quote-calculator';

export class AppliedSurchargeResponseDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  amount: number;
}

export class AppliedDiscountResponseDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  amount: number;
}

export class QuoteLineResponseDto {
  @ApiProperty()
  positionKey: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  net: number;

  @ApiProperty()
  gross: number;

  @ApiProperty({ type: [AppliedSurchargeResponseDto] })
  appliedSurcharges: AppliedSurchargeResponseDto[];

  @ApiProperty({ type: [AppliedDiscountResponseDto] })
  appliedDiscounts: AppliedDiscountResponseDto[];
}

export class VatBreakdownResponseDto {
  @ApiProperty()
  vatRate: number;

  @ApiProperty()
  netTotal: number;

  @ApiProperty()
  vatAmount: number;

  @ApiProperty()
  grossTotal: number;
}

export class QuoteTotalsResponseDto {
  @ApiProperty()
  net: number;

  @ApiProperty()
  totalDiscount: number;

  @ApiProperty()
  vat: number;

  @ApiProperty()
  gross: number;
}

export class QuoteResponseDto {
  @ApiProperty({ type: [QuoteLineResponseDto] })
  lines: QuoteLineResponseDto[];

  @ApiProperty({ type: [VatBreakdownResponseDto] })
  vatBreakdown: VatBreakdownResponseDto[];

  @ApiProperty({ type: QuoteTotalsResponseDto })
  totals: QuoteTotalsResponseDto;

  static from(result: QuoteResult): QuoteResponseDto {
    return {
      lines: result.lines.map((line) => ({
        positionKey: line.positionKey,
        quantity: line.quantity,
        net: line.net,
        gross: line.gross,
        appliedSurcharges: [...line.appliedSurcharges],
        appliedDiscounts: [...line.appliedDiscounts],
      })),
      vatBreakdown: [...result.vatBreakdown],
      totals: { ...result.totals },
    };
  }
}
