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
import { AdminRole, type PublicProduct } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { ProductDto } from './dto/product.dto.js';
import { ProductsService, type PublicProductWithDates } from './products.service.js';

/** Any active admin can read products; only system/manager can change them. */
@Controller({ path: 'admin/products', version: '1' })
@UseGuards(AdminGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) { }

  @Get()
  findAll(): Promise<PublicProductWithDates[]> {
    return this.products.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicProduct<Date>> {
    return this.products.findOne(id);
  }

  @Post()
  @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
  create(@Body() dto: ProductDto): Promise<PublicProduct<Date>> {
    return this.products.create(dto);
  }

  @Put(':id')
  @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProductDto,
  ): Promise<PublicProduct<Date>> {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.products.remove(id);
  }
}
