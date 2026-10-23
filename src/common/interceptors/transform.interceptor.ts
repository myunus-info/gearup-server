import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map(result => {
        // If response headers have already been sent (e.g. manual redirect), do not modify
        if (response.headersSent) {
          return result;
        }

        const statusCode = response.statusCode || 200;

        // If result is already formatted as ApiResponse, return it directly
        if (result && typeof result === 'object' && 'success' in result && 'statusCode' in result) {
          return result;
        }

        // Check if result provided a message, data, and/or meta
        let message = 'Operation successful';
        let data = result;
        let meta: Record<string, unknown> | undefined = undefined;

        if (
          result &&
          typeof result === 'object' &&
          !Array.isArray(result) &&
          !(result instanceof Date) &&
          'data' in result
        ) {
          if ('message' in result && typeof result.message === 'string') {
            message = result.message;
          }
          data = result.data;
          if ('meta' in result) {
            meta = result.meta as Record<string, unknown>;
          }
        }

        return {
          success: true,
          statusCode,
          message,
          data,
          ...(meta ? { meta } : {}),
        };
      }),
    );
  }
}
