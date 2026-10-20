import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { GearCondition } from '../../../common/enums/gear-condition.enum.js';

export class QueryGearDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsEnum(GearCondition)
  @IsOptional()
  condition?: GearCondition;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
  price?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 1))
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 10))
  limit?: number = 10;

  @IsIn(['createdAt', 'name', 'pricePerDay'])
  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC' = 'desc';
}
