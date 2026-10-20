import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2, { message: 'Category name must be at least 2 characters long' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
