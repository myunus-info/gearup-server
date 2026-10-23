import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { PaymentProvider } from '../../../common/enums/payment-provider.enum.js';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Order ID is required' })
  orderId: string;

  @IsString()
  @IsOptional()
  tranId?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;
}
