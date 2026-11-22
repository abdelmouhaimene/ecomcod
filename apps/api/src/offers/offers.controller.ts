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
import { AdminRole, type PublicOffer } from '@repo/types';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { OfferDto } from './dto/offer.dto.js';
import { OffersService, type PublicOfferWithDates } from './offers.service.js';

@Controller({ path: 'admin/offers', version: '1' })
@UseGuards(AdminGuard)
export class OffersController {
    constructor(private readonly offers: OffersService) { }

    @Get()
    findAll(): Promise<PublicOfferWithDates[]> {
        return this.offers.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicOffer<Date>> {
        return this.offers.findOne(id);
    }

    @Post()
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    create(@Body() dto: OfferDto): Promise<PublicOffer<Date>> {
        return this.offers.create(dto);
    }

    @Put(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferDto): Promise<PublicOffer<Date>> {
        return this.offers.update(id, dto);
    }

    @Delete(':id')
    @Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
    @HttpCode(204)
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.offers.remove(id);
    }
}
