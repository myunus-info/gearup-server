import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PaymentProvider } from '../../../common/enums/payment-provider.enum.js';

export class RentalOrderItemInputDto {
  @IsString()
  gearItemId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;
}

export class CreateRentalDto {
  @IsDateString({}, { message: 'startDate must be a valid ISO date string' })
  startDate: string;

  @IsDateString({}, { message: 'endDate must be a valid ISO date string' })
  endDate: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one gear item is required' })
  @ValidateNested({ each: true })
  @Type(() => RentalOrderItemInputDto)
  items: RentalOrderItemInputDto[];

  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider = PaymentProvider.SSLCOMMERZ;
}
