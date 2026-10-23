import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentProvider } from '../../../common/enums/payment-provider.enum.js';

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Order ID is required' })
  orderId: string;

  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider = PaymentProvider.SSLCOMMERZ;
}
