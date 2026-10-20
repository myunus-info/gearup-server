import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'GearUp REST API',
      version: '1.0.0',
      description: 'Production NestJS 12 Enterprise Gear-Rental Marketplace API',
      documentation: '/api/docs',
      status: 'online',
    };
  }
}
