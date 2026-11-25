import { Controller, Get } from '@nestjs/common';
import { PolicyService, type PublicPolicyArticleWithDates } from './policy.service.js';

/** Read-only active policy articles for the storefront. */
@Controller({ path: 'policy', version: '1' })
export class PublicPolicyController {
    constructor(private readonly policy: PolicyService) { }

    @Get()
    findActive(): Promise<PublicPolicyArticleWithDates[]> {
        return this.policy.findActive();
    }
}
