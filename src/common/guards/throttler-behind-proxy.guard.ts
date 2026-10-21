import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0].trim();
    }
    return (
      req.headers?.['x-real-ip'] ||
      req.socket?.remoteAddress ||
      '127.0.0.1'
    );
  }
}
