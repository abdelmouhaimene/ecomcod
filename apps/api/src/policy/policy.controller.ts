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
import { AdminRole, type PublicPolicyArticle } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { PolicyArticleDto } from './dto/policy.dto.js';
import { PolicyService, type PublicPolicyArticleWithDates } from './policy.service.js';

/** Any active admin can read policy articles; system/manager may change them. */
@Controller({ path: 'admin/policy', version: '1' })
@UseGuards(AdminGuard)
export class PolicyController {
    constructor(private readonly policy: PolicyService) { }

    @Get()
    findAll(): Promise<PublicPolicyArticleWithDates[]> {
        return this.policy.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicPolicyArticle<Date>> {
        return this.policy.findOne(id);
    }

    @Post()
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    create(@Body() dto: PolicyArticleDto): Promise<PublicPolicyArticle<Date>> {
        return this.policy.create(dto);
    }

    @Put(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: PolicyArticleDto,
    ): Promise<PublicPolicyArticle<Date>> {
        return this.policy.update(id, dto);
    }

    @Delete(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    @HttpCode(204)
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.policy.remove(id);
    }
}
