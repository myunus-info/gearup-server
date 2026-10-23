import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
  DynamicModule,
  Module,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

export interface ThrottleOptions {
  limit: number;
  ttl: number; // in milliseconds
}

export interface ThrottleDecoratorArg {
  default?: ThrottleOptions;
  [key: string]: ThrottleOptions | undefined;
}

export const THROTTLE_METADATA_KEY = 'custom_throttle_metadata';

export const Throttle = (options: ThrottleDecoratorArg) => SetMetadata(THROTTLE_METADATA_KEY, options);

export const THROTTLER_OPTIONS_TOKEN = 'CUSTOM_THROTTLER_OPTIONS';

export interface ThrottlerModuleOptions {
  ttl: number; // in ms
  limit: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number; // timestamp in ms
}

@Injectable()
export class ThrottlerGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitRecord>();

  constructor(
    @Inject(THROTTLER_OPTIONS_TOKEN)
    private readonly defaultOptions: ThrottlerModuleOptions[],
    private readonly reflector: Reflector,
  ) {}

  protected getTracker(req: Request): string {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return (req.headers?.['x-real-ip'] as string) || req.socket?.remoteAddress || '127.0.0.1';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // Route-level override takes precedence over global default
    const routeThrottle = this.reflector.getAllAndOverride<ThrottleDecoratorArg>(THROTTLE_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const defaultOpt = this.defaultOptions?.[0] || { ttl: 60000, limit: 20 };
    const limit = routeThrottle?.default?.limit ?? defaultOpt.limit;
    const ttl = routeThrottle?.default?.ttl ?? defaultOpt.ttl;

    const tracker = this.getTracker(req);
    const key = `${tracker}:${context.getClass().name}:${context.getHandler().name}`;
    const now = Date.now();

    const record = this.store.get(key);

    if (!record || now > record.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + ttl });
      if (res?.setHeader) {
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - 1));
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + ttl) / 1000));
      }
      return true;
    }

    if (record.count >= limit) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      if (res?.setHeader) {
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
      }
      throw new HttpException('ThrottlerException: Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    record.count += 1;
    if (res?.setHeader) {
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
    }
    return true;
  }
}

@Module({})
export class ThrottlerModule {
  static forRoot(options: ThrottlerModuleOptions[]): DynamicModule {
    return {
      module: ThrottlerModule,
      global: true,
      providers: [
        {
          provide: THROTTLER_OPTIONS_TOKEN,
          useValue: options,
        },
        ThrottlerGuard,
      ],
      exports: [THROTTLER_OPTIONS_TOKEN, ThrottlerGuard],
    };
  }
}
