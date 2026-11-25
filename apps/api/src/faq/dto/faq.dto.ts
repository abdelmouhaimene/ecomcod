import { Transform, Type } from 'class-transformer';
import {
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';
import type { FaqPayload } from '@repo/types';

const trim = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

export class FaqDto implements FaqPayload {
    @Transform(trim)
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    question: string;

    @Transform(trim)
    @IsString()
    @MinLength(1)
    @MaxLength(10_000)
    answer: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    position?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
