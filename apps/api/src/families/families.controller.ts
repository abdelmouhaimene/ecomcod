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
import { AdminRole, type PublicFamily } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { FamilyDto } from './dto/family.dto.js';
import { FamiliesService, type PublicFamilyWithDates } from './families.service.js';

@Controller({ path: 'admin/families', version: '1' })
@UseGuards(AdminGuard)
export class FamiliesController {
    constructor(private readonly families: FamiliesService) { }

    @Get()
    findAll(): Promise<PublicFamilyWithDates[]> {
        return this.families.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicFamily<Date>> {
        return this.families.findOne(id);
    }

    @Post()
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    create(@Body() dto: FamilyDto): Promise<PublicFamily<Date>> {
        return this.families.create(dto);
    }

    @Put(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FamilyDto): Promise<PublicFamily<Date>> {
        return this.families.update(id, dto);
    }

    @Delete(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    @HttpCode(204)
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.families.remove(id);
    }
}
