import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { Role } from '../src/common/enums/role.enum.js';

describe('Authentication & Protected Flow (E2E)', () => {
  let app: INestApplication;
  let customerAccessToken: string;
  let providerAccessToken: string;
  let customerCookies: string[];

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('Registers a customer successfully', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Alice Traveler',
        email: 'alice@example.com',
        password: 'password123',
        role: Role.CUSTOMER,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('alice@example.com');
    expect(res.body.data.password).toBeUndefined();
  });

  it('Registers a provider with shop profile', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        name: 'Bob Lensman',
        email: 'bob@example.com',
        password: 'password123',
        role: Role.PROVIDER,
        shopName: 'Bob Lens & Gear Rentals',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe(Role.PROVIDER);
  });

  it('Logs in customer, returning JWT and setting httpOnly cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@example.com',
        password: 'password123',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    customerAccessToken = res.body.data.accessToken;

    customerCookies = res.headers['set-cookie'] as any as string[];
    expect(customerCookies).toBeDefined();
    expect(customerCookies.some((c) => c.includes('accessToken='))).toBe(true);
    expect(customerCookies.some((c) => c.includes('refreshToken='))).toBe(true);
  });

  it('Logs in provider to get provider bearer token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({
        email: 'bob@example.com',
        password: 'password123',
      })
      .expect(200);

    providerAccessToken = res.body.data.accessToken;
    expect(providerAccessToken).toBeDefined();
  });

  it('GET /api/v1/auth/me authenticated via Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('alice@example.com');
  });

  it('GET /api/v1/auth/me authenticated via httpOnly cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', customerCookies)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('alice@example.com');
  });

  it('Provider creates a category', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${providerAccessToken}`)
      .send({
        name: 'Cameras & Lenses',
        description: 'Professional cinema and mirrorless equipment',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Cameras & Lenses');
  });

  it('Customer cannot create a category (RBAC forbidden)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .send({
        name: 'Camping Gear',
      })
      .expect(403);
  });

  it('Public can list categories', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
