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
import type { PolicyArticlePayload } from '@repo/types';

const trim = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

export class PolicyArticleDto implements PolicyArticlePayload {
    @Transform(trim)
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    title: string;

    @Transform(trim)
    @IsString()
    @MinLength(1)
    @MaxLength(20_000)
    body: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    position?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
