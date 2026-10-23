import 'pg';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AppModule } from '../dist/app.module.js';
import { AllExceptionsFilter } from '../dist/common/filters/http-exception.filter.js';
import { LoggingInterceptor } from '../dist/common/interceptors/logging.interceptor.js';

let cachedServer: express.Express | null = null;

async function bootstrapServer(): Promise<express.Express> {
  if (cachedServer) {
    return cachedServer;
  }

  const expressApp = express();
  expressApp.set('trust proxy', 1);
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  const configService = app.get(ConfigService);
  expressApp.use(cookieParser());

  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const appUrl = configService.get<string>('CLIENT_URL');
  const allowedOrigins = [appUrl, appUrl?.replace(/\/$/, ''), 'https://gearup-nestjs-server.vercel.app'].filter(
    Boolean,
  ) as string[];

  const extraOrigins = (appUrl || '')
    .split(',')
    .map(u => u.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: isProduction
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          const isGatewayOrigin =
            origin &&
            (origin.includes('sslcommerz.com') ||
              origin.includes('stripe.com'));

          if (
            !origin ||
            allowedOrigins.includes(origin) ||
            extraOrigins.includes(origin) ||
            origin.endsWith('.vercel.app') ||
            isGatewayOrigin
          ) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        }
      : true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['/', 'health'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('GearUp Enterprise API')
    .setDescription(
      'Production NestJS 12 REST API for the GearUp outdoor and photography gear-rental marketplace platform.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication', 'User registration, login, JWT cookies, and profile')
    .addTag('Categories', 'Gear categories management')
    .addTag('Gears (Public Catalog)', 'Browse and filter available gear items')
    .addTag('Provider Dashboard', 'Inventory and order management for equipment providers')
    .addTag('Rentals (Orders)', 'Order placement, calculations, and tracking')
    .addTag('Payments', 'Stripe & SSLCommerz payment processing and webhooks')
    .addTag('Reviews', 'Verified ratings and customer feedback')
    .addTag('Admin Oversight', 'Administrative controls for users, listings, and orders')
    .addTag('AI Concierge', 'Intelligent conversational assistant grounded in real-time gear inventory')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'GearUp Enterprise API Documentation',
    customCssUrl: ['https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css'],
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js',
    ],
  });

  await app.init();
  cachedServer = expressApp;
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  try {
    const server = await bootstrapServer();
    return server(req, res);
  } catch (err: any) {
    console.error('Fatal initialization error in Vercel function:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          success: false,
          statusCode: 500,
          message: 'Serverless Function Startup Error',
          error: err?.message || String(err),
        }),
      );
    }
  }
}
