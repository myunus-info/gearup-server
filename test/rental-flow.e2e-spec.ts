import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { Role } from '../src/common/enums/role.enum.js';
import { GearCondition } from '../src/common/enums/gear-condition.enum.js';

describe('Gear Rental & Order Lifecycle (E2E)', () => {
  let app: INestApplication;
  let customerToken: string;
  let providerToken: string;
  let categoryId: string;
  let gearItemId: string;
  let rentalOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', {
      exclude: ['/', 'health'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    // Setup: Customer
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      name: 'Renter One',
      email: 'renter@test.com',
      password: 'password123',
      role: Role.CUSTOMER,
      phone: '01711111111',
      address: 'Dhaka',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'renter@test.com', password: 'password123' });
    customerToken = loginRes.body.data.accessToken;

    // Setup: Provider
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      name: 'Gear Provider',
      email: 'provider@test.com',
      password: 'password123',
      role: Role.PROVIDER,
      shopName: 'Pro Gear Hub',
    });

    const provLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'provider@test.com', password: 'password123' });
    providerToken = provLoginRes.body.data.accessToken;

    // Create Category
    const catRes = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ name: 'Audio & Microphones', description: 'Wireless mics and recorders' });
    categoryId = catRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Provider adds a gear item', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/provider/gear')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        categoryId,
        name: 'Rode Wireless Pro Mic Kit',
        description: 'Dual transmitter 32-bit float wireless mic kit',
        brand: 'Rode',
        pricePerDay: 50,
        depositAmount: 100,
        quantityTotal: 5,
        condition: GearCondition.NEW,
        images: ['https://example.com/rode.jpg'],
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Rode Wireless Pro Mic Kit');
    expect(res.body.data.quantityAvailable).toBe(5);
    gearItemId = res.body.data.id;
  });

  it('Customer places a rental order for 2 units across 3 days', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rentals')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        startDate: '2026-11-01',
        endDate: '2026-11-04', // 3 days
        items: [{ gearItemId, quantity: 2 }],
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('paymentUrl');
    expect(res.body.data.order.totalAmount).toBe(300); // 50 * 2 * 3 = 300
    rentalOrderId = res.body.data.order.id;
  });

  it('Gear stock decremented after order is placed', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/gears/${gearItemId}`)
      .expect(200);

    expect(res.body.data.quantityAvailable).toBe(3); // 5 - 2 = 3
  });

  it('Customer lists their rental orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rentals')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('Confirm payment webhook marks payment PAID and order CONFIRMED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/confirm')
      .send({
        orderId: rentalOrderId,
        tranId: 'TXN-TEST-12345',
        payload: {
          val_id: 'VAL-12345',
          tran_date: new Date().toISOString(),
        },
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('CONFIRMED');
    expect(res.body.data.payment.status).toBe('PAID');
  });

  it('Provider transitions order from CONFIRMED -> PICKED_UP -> RETURNED', async () => {
    // CONFIRMED -> PICKED_UP
    const pickRes = await request(app.getHttpServer())
      .patch(`/api/v1/provider/orders/${rentalOrderId}`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'PICKED_UP' })
      .expect(200);
    expect(pickRes.body.data.status).toBe('PICKED_UP');

    // PICKED_UP -> RETURNED
    const retRes = await request(app.getHttpServer())
      .patch(`/api/v1/provider/orders/${rentalOrderId}`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'RETURNED' })
      .expect(200);
    expect(retRes.body.data.status).toBe('RETURNED');
  });

  it('Gear stock restored after order RETURNED', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/gears/${gearItemId}`)
      .expect(200);

    expect(res.body.data.quantityAvailable).toBe(5); // Restored back to 5!
  });

  it('Customer can leave review after gear is RETURNED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        gearItemId,
        rentalOrderId,
        rating: 5,
        comment: 'Crystal clear audio, flawless condition!',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.rating).toBe(5);
  });

  it('Customer cannot leave duplicate review for same order and gear', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        gearItemId,
        rentalOrderId,
        rating: 4,
      })
      .expect(409);
  });
});
