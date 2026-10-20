import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { GearCondition } from '../../../common/enums/gear-condition.enum.js';

export class CreateGearDto {
  @IsString()
  @MinLength(1, { message: 'Category ID is required' })
  categoryId: string;

  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsNumber()
  @Min(0, { message: 'Price per day must be non-negative' })
  @Transform(({ value }) => Number(value))
  pricePerDay: number;

  @IsNumber()
  @Min(0, { message: 'Deposit amount must be non-negative' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  depositAmount?: number;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Transform(({ value }) => parseInt(value, 10))
  quantityTotal: number;

  @IsEnum(GearCondition)
  @IsOptional()
  condition?: GearCondition = GearCondition.GOOD;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
