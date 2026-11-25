import { Controller, Get } from '@nestjs/common';
import { FaqService, type PublicFaqItemWithDates } from './faq.service.js';

/** Read-only active FAQ entries for the storefront. */
@Controller({ path: 'faq', version: '1' })
export class PublicFaqController {
    constructor(private readonly faq: FaqService) { }

    @Get()
    findActive(): Promise<PublicFaqItemWithDates[]> {
        return this.faq.findActive();
    }
}
