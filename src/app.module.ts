import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './config/env.validation.js';
import { dataSourceOptions } from './data-source.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { GearsModule } from './modules/gears/gears.module.js';
import { ProviderModule } from './modules/provider/provider.module.js';
import { RentalsModule } from './modules/rentals/rentals.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 20,
      },
    ]),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    AdminModule,
    CategoriesModule,
    GearsModule,
    ProviderModule,
    RentalsModule,
    PaymentsModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
