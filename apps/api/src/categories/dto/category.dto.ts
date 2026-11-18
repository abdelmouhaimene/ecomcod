import { IsString, Length, Matches } from 'class-validator';
import type { CategoryPayload } from '@repo/types';

export class CategoryDto implements CategoryPayload {
    @IsString()
    @Length(1, 100)
    name: string;

    @IsString()
    @Length(1, 50)
    @Matches(/^[a-zA-Z0-9_-]+$/, {
        message: 'ref may only contain letters, numbers, dashes and underscores',
    })
    ref: string;
}
