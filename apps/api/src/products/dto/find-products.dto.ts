import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { ProductListQuery } from '@repo/types';

/** URL query parameters arrive as strings; empty strings mean "not provided". */
const optionalNumber = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    return typeof value === 'string' ? Number(value.trim()) : value;
};

const optionalTrimmedString = ({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
};

/** Query DTO for the public paginated catalog (`GET /v1/products`). */
export class FindProductsDto implements ProductListQuery {
    @Transform(optionalNumber)
    @IsOptional()
    @IsInt()
    @Min(1)
    page = 1;

    @Transform(optionalNumber)
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1000)
    limit = 9;

    @Transform(optionalTrimmedString)
    @IsOptional()
    @IsString()
    @MaxLength(120)
    q?: string;

    @Transform(optionalTrimmedString)
    @IsOptional()
    @IsUUID('4')
    categoryId?: string;

    @Transform(optionalTrimmedString)
    @IsOptional()
    @IsUUID('4')
    familyId?: string;
}
