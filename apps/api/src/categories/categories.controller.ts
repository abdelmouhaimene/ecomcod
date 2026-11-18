import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminRole, type PublicCategory } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { CategoryDto } from './dto/category.dto.js';
import { CategoriesService, type PublicCategoryWithDates } from './categories.service.js';

/** Any active admin can read categories; only system/manager can change them. */
@Controller({ path: 'admin/categories', version: '1' })
@UseGuards(AdminGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) { }

  @Get()
  findAll(): Promise<PublicCategoryWithDates[]> {
    return this.categories.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicCategory<Date>> {
    return this.categories.findOne(id);
  }

  @Post()
  @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
  create(@Body() dto: CategoryDto): Promise<PublicCategory<Date>> {
    return this.categories.create(dto);
  }

  @Put(':id')
  @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CategoryDto,
  ): Promise<PublicCategory<Date>> {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categories.remove(id);
  }
}
