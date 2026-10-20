import dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from './modules/auth/entities/user.entity.js';
import { ProviderProfile } from './modules/auth/entities/provider-profile.entity.js';
import { Category } from './modules/categories/entities/category.entity.js';
import { GearItem } from './modules/gears/entities/gear-item.entity.js';
import { RentalOrder } from './modules/rentals/entities/rental-order.entity.js';
import { RentalOrderItem } from './modules/rentals/entities/rental-order-item.entity.js';
import { Payment } from './modules/payments/entities/payment.entity.js';
import { Review } from './modules/reviews/entities/review.entity.js';

const environment = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${environment}` });
dotenv.config({ path: '.env' });

export const allEntities = [
  User,
  ProviderProfile,
  Category,
  GearItem,
  RentalOrder,
  RentalOrderItem,
  Payment,
  Review,
];

export const getDataSourceOptions = (): DataSourceOptions => {
  const databaseUrl = process.env.DATABASE_URL;

  if (environment === 'production' || (databaseUrl && !databaseUrl.includes('sqlite'))) {
    return {
      type: 'postgres',
      url: databaseUrl,
      entities: allEntities,
      migrations: ['dist/migrations/*.js'],
      migrationsRun: false,
      synchronize: environment !== 'production',
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : undefined,
    };
  }

  if (environment === 'test') {
    return {
      type: 'better-sqlite3',
      database: process.env.DB_NAME || ':memory:',
      entities: allEntities,
      synchronize: true,
      dropSchema: true,
    };
  }

  // Development fallback: better-sqlite3 for zero-setup local development
  return {
    type: 'better-sqlite3',
    database: process.env.DB_NAME || 'gearup.sqlite',
    entities: allEntities,
    synchronize: true,
  };
};

export const dataSourceOptions = getDataSourceOptions();
export default new DataSource(dataSourceOptions);
