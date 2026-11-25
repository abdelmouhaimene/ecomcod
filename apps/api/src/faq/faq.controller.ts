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
import { AdminRole, type PublicFaqItem } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { FaqDto } from './dto/faq.dto.js';
import { FaqService, type PublicFaqItemWithDates } from './faq.service.js';

/** Any active admin can read FAQ entries; system/manager may change them. */
@Controller({ path: 'admin/faq', version: '1' })
@UseGuards(AdminGuard)
export class FaqController {
    constructor(private readonly faq: FaqService) { }

    @Get()
    findAll(): Promise<PublicFaqItemWithDates[]> {
        return this.faq.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicFaqItem<Date>> {
        return this.faq.findOne(id);
    }

    @Post()
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    create(@Body() dto: FaqDto): Promise<PublicFaqItem<Date>> {
        return this.faq.create(dto);
    }

    @Put(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: FaqDto,
    ): Promise<PublicFaqItem<Date>> {
        return this.faq.update(id, dto);
    }

    @Delete(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    @HttpCode(204)
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.faq.remove(id);
    }
}
