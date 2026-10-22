import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 8000;

  // Cookie parser for automatic JWT cookie extraction
  app.use(cookieParser());

  // Security & Cross-Origin (Configured for Next.js ofetch credentials: "include")
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const appUrl = configService.get<string>('APP_URL');

  app.enableCors({
    origin: isProduction
      ? (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => {
          if (!origin || origin === appUrl) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        }
      : true,
    credentials: true,
  });

  // Set API prefix /api/v1 (with exclusions for root health check)
  app.setGlobalPrefix('api/v1', {
    exclude: ['/', 'health'],
  });

  // Global enterprise filters & interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger / OpenAPI documentation
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
    .addTag('Payments', 'SSLCommerz payment processing and webhooks')
    .addTag('Reviews', 'Verified ratings and customer feedback')
    .addTag('Admin Oversight', 'Administrative controls for users, listings, and orders')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'GearUp Enterprise API Documentation',
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    ],
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js',
    ],
  });

  await app.listen(port);

  logger.log(`🚀 Application running at: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation at: http://localhost:${port}/api/docs`);
}

await bootstrap();
