import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import type {
    GalleryPhotoPayload,
    GalleryStatusPayload,
} from '@repo/types';

const trim = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

/** Accept full ISO timestamps but store only the calendar date. */
const normalizeDate = ({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : trimmed;
};

export class GalleryPhotoDto implements GalleryPhotoPayload {
    @Transform(trim)
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    image: string;

    @Transform(trim)
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name: string;

    @Transform(normalizeDate)
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'date must be in YYYY-MM-DD format',
    })
    @IsDateString()
    date: string;

    @Transform(trim)
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    location: string;
}

export class GalleryStatusDto implements GalleryStatusPayload {
    @IsBoolean()
    isActive: boolean;
}
