import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoryRepository.findOne({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Category already exists');
    }

    const category = this.categoryRepository.create(dto);
    return this.categoryRepository.save(category);
  }

  async findAll(id?: string) {
    const categories = await this.categoryRepository.find({
      where: id ? { id } : {},
      relations: { gearItems: true },
      order: { name: 'ASC' },
    });

    if (!categories || categories.length === 0) {
      throw new NotFoundException('Categories not found!');
    }

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      createdAt: cat.createdAt,
      gearCount: cat.gearItems?.length || 0,
    }));
  }
}
