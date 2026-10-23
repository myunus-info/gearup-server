import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory.js';
import { PaymentProvider } from '../../common/enums/payment-provider.enum.js';
import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { RentalStatus } from '../../common/enums/rental-status.enum.js';

describe('PaymentsService & PaymentGatewayFactory (Separation of Concerns)', () => {
  let paymentsService: PaymentsService;
  let gatewayFactory: PaymentGatewayFactory;
  let mockPaymentRepo: any;
  let mockOrderRepo: any;
  let mockSslcommerzGateway: any;
  let mockStripeGateway: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockPaymentRepo = {
      findOne: vi.fn(),
      create: vi.fn(data => ({ ...data, id: 'pay-1' })),
      save: vi.fn(data => Promise.resolve(data)),
      createQueryBuilder: vi.fn(),
    };

    mockOrderRepo = {
      findOne: vi.fn(),
      save: vi.fn(data => Promise.resolve(data)),
    };

    mockSslcommerzGateway = {
      provider: PaymentProvider.SSLCOMMERZ,
      initiatePayment: vi.fn().mockResolvedValue('https://sandbox.sslcommerz.com/gw/pay-123'),
      verifyPayment: vi.fn().mockResolvedValue({
        isPaid: true,
        transactionId: 'TXN-SSL-123',
        method: 'CREDIT_CARD',
      }),
    };

    mockStripeGateway = {
      provider: PaymentProvider.STRIPE,
      initiatePayment: vi.fn().mockResolvedValue('https://checkout.stripe.com/pay/cs_123'),
      verifyPayment: vi.fn().mockResolvedValue({
        isPaid: true,
        transactionId: 'pi_stripe_123',
        method: 'STRIPE_CARD',
      }),
      processWebhook: vi.fn().mockReturnValue({
        orderId: 'order-1',
        sessionId: 'cs_123',
        tranId: 'pi_123',
      }),
    };

    mockDataSource = {
      transaction: vi.fn(async cb => {
        const mockManager = {
          findOne: vi.fn((entity, options) => {
            if (options.where.rentalOrderId || options.where.id === 'pay-1') {
              return Promise.resolve({
                id: 'pay-1',
                rentalOrderId: 'order-1',
                status: PaymentStatus.PENDING,
                amount: 150,
              });
            }
            if (options.where.id === 'order-1') {
              return Promise.resolve({
                id: 'order-1',
                status: RentalStatus.PLACED,
              });
            }
            return Promise.resolve(null);
          }),
          save: vi.fn((entity, data) => Promise.resolve(data)),
        };
        return cb(mockManager);
      }),
    };

    gatewayFactory = new PaymentGatewayFactory(mockSslcommerzGateway, mockStripeGateway);
    paymentsService = new PaymentsService(
      mockPaymentRepo,
      mockOrderRepo,
      gatewayFactory,
      mockStripeGateway,
      mockDataSource,
    );
  });

  describe('PaymentGatewayFactory', () => {
    it('returns SslcommerzGateway when requested', () => {
      const gateway = gatewayFactory.get(PaymentProvider.SSLCOMMERZ);
      expect(gateway.provider).toBe(PaymentProvider.SSLCOMMERZ);
      expect(gateway).toBe(mockSslcommerzGateway);
    });

    it('returns StripeGateway when requested', () => {
      const gateway = gatewayFactory.get(PaymentProvider.STRIPE);
      expect(gateway.provider).toBe(PaymentProvider.STRIPE);
      expect(gateway).toBe(mockStripeGateway);
    });

    it('resolves provider from session_id starting with cs_', () => {
      const resolved = gatewayFactory.resolveProvider({
        orderId: 'order-1',
        sessionId: 'cs_test_session_abc',
      });
      expect(resolved).toBe(PaymentProvider.STRIPE);
    });

    it('defaults to SSLCOMMERZ when no provider or stripe signature is detected', () => {
      const resolved = gatewayFactory.resolveProvider({
        orderId: 'order-1',
        tranId: 'TRNX_12345',
      });
      expect(resolved).toBe(PaymentProvider.SSLCOMMERZ);
    });
  });

  describe('PaymentsService delegation', () => {
    it('initiates SSLCommerz payment through factory without coupling', async () => {
      const url = await paymentsService.initiatePayment(
        { id: 'cust-1', name: 'User' },
        { id: 'order-1', totalAmount: 100 },
        PaymentProvider.SSLCOMMERZ,
      );

      expect(mockSslcommerzGateway.initiatePayment).toHaveBeenCalled();
      expect(mockStripeGateway.initiatePayment).not.toHaveBeenCalled();
      expect(url).toBe('https://sandbox.sslcommerz.com/gw/pay-123');
    });

    it('initiates Stripe payment through factory cleanly', async () => {
      const url = await paymentsService.initiatePayment(
        { id: 'cust-1', name: 'User' },
        { id: 'order-1', totalAmount: 100 },
        PaymentProvider.STRIPE,
      );

      expect(mockStripeGateway.initiatePayment).toHaveBeenCalled();
      expect(mockSslcommerzGateway.initiatePayment).not.toHaveBeenCalled();
      expect(url).toBe('https://checkout.stripe.com/pay/cs_123');
    });

    it('confirms payment via Stripe gateway and executes atomic status updates', async () => {
      const result = await paymentsService.confirmPayment({
        orderId: 'order-1',
        sessionId: 'cs_123',
        provider: PaymentProvider.STRIPE,
      });

      expect(mockStripeGateway.verifyPayment).toHaveBeenCalled();
      expect(result.payment.status).toBe(PaymentStatus.PAID);
      expect(result.order.status).toBe(RentalStatus.CONFIRMED);
    });
  });
});
