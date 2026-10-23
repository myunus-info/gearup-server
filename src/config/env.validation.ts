import { plainToInstance, Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => Number(value))
  PORT: number = 8000;

  @IsString()
  @IsOptional()
  JWT_SECRET: string = 'gearUpDefaultSecretKey12345';

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '1d';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string = 'gearUpDefaultRefreshSecretKey12345';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  DB_NAME: string = 'gearup.sqlite';

  @IsString()
  @IsOptional()
  CLIENT_URL: string = 'https://gearup-six-kohl.vercel.app';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => Number(value))
  BCRYPT_SALT_ROUNDS: number = 12;

  @IsString()
  @IsOptional()
  STORE_ID: string = 'testbox';

  @IsString()
  @IsOptional()
  STORE_PASS: string = 'qwerty';

  @IsString()
  @IsOptional()
  SUCCESS_URL: string = 'https://gearup-six-kohl.vercel.app/payment/success';

  @IsString()
  @IsOptional()
  FAIL_URL: string = 'https://gearup-six-kohl.vercel.app/payment/fail';

  @IsString()
  @IsOptional()
  CANCEL_URL: string = 'https://gearup-six-kohl.vercel.app/payment/cancel';

  @IsString()
  @IsOptional()
  SSL_PAYMENT_API: string = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';

  @IsString()
  @IsOptional()
  SSL_VALIDATION_API: string = 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';

  @IsString()
  @IsOptional()
  GEMINI_API_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }

  if (validated.NODE_ENV === Environment.Production) {
    if (!validated.JWT_SECRET || validated.JWT_SECRET === 'gearUpDefaultSecretKey12345') {
      throw new Error(
        'Insecure configuration: JWT_SECRET must be explicitly defined and cannot use default fallback in production!',
      );
    }
    if (!validated.JWT_REFRESH_SECRET || validated.JWT_REFRESH_SECRET === 'gearUpDefaultRefreshSecretKey12345') {
      throw new Error(
        'Insecure configuration: JWT_REFRESH_SECRET must be explicitly defined and cannot use default fallback in production!',
      );
    }
  }

  return validated;
}
