import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { PublicFamily } from '@repo/types';
import { FamiliesService, type PublicFamilyWithDates } from './families.service.js';

@Controller({ path: 'families', version: '1' })
export class PublicFamiliesController {
    constructor(private readonly families: FamiliesService) { }

    @Get()
    findAll(): Promise<PublicFamilyWithDates[]> {
        return this.families.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicFamily<Date>> {
        return this.families.findOne(id);
    }
}
