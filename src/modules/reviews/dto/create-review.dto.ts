import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty({ message: 'gearItemId is required' })
  gearItemId: string;

  @IsString()
  @IsNotEmpty({ message: 'rentalOrderId is required' })
  rentalOrderId: string;

  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 5' })
  @Max(5, { message: 'Rating must be between 1 and 5' })
  @Transform(({ value }) => parseInt(value, 10))
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
