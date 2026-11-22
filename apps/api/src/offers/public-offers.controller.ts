import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { PublicOffer } from '@repo/types';
import { OffersService, type PublicOfferWithDates } from './offers.service.js';

@Controller({ path: 'offers', version: '1' })
export class PublicOffersController {
    constructor(private readonly offers: OffersService) { }

    @Get('active')
    active(): Promise<PublicOfferWithDates[]> {
        return this.offers.findActive();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicOffer<Date>> {
        return this.offers.findOne(id);
    }
}
