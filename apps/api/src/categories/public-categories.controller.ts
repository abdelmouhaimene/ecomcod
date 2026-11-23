import { Controller, Get } from '@nestjs/common';
import { CategoriesService, type PublicCategoryWithDates } from './categories.service.js';

/** Read-only categories for the storefront; all writes stay under /admin/categories. */
@Controller({ path: 'categories', version: '1' })
export class PublicCategoriesController {
    constructor(private readonly categories: CategoriesService) { }

    @Get()
    findAll(): Promise<PublicCategoryWithDates[]> {
        return this.categories.findAll();
    }
}
