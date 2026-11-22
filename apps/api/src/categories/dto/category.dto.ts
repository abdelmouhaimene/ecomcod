import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import type { CategoryPayload } from '@repo/types';

const normalizeIcon = ({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
};

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

    @Transform(normalizeIcon)
    @IsOptional()
    @IsString()
    @MaxLength(500)
    icon?: string | null;
}
