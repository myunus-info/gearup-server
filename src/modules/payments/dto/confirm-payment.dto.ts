import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Order ID is required' })
  orderId: string;

  @IsString()
  @IsNotEmpty({ message: 'Transaction ID is required' })
  tranId: string;

  @IsObject()
  @IsNotEmpty()
  payload: Record<string, any>;
}
