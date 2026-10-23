import { PaymentProvider } from '../../../common/enums/payment-provider.enum.js';

export interface PaymentCustomerData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface PaymentOrderItemData {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface PaymentOrderData {
  id: string;
  totalAmount: number;
  items?: PaymentOrderItemData[];
}

export interface PaymentVerificationResult {
  isPaid: boolean;
  transactionId?: string;
  method?: string;
  amount?: number;
  currency?: string;
  rawResponse?: Record<string, unknown>;
}

export interface IPaymentGateway {
  readonly provider: PaymentProvider;
  initiatePayment(customer: PaymentCustomerData, order: PaymentOrderData): Promise<string>;
  verifyPayment(verificationId: string): Promise<PaymentVerificationResult>;
}
