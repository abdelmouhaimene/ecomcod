import { Transform, Type } from 'class-transformer';
import {
    ArrayNotEmpty,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    registerDecorator,
    ValidateNested,
    ValidationArguments,
} from 'class-validator';
import type {
    StockEntryFilter,
    StockEntryItemPayload,
    StockEntryPayload,
    SupplierPayload,
} from '@repo/types';

const trimString = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

/** Calendar dates are accepted as `YYYY-MM-DD`, without a time component. */
function isCalendarDate(value: unknown): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function calendarDate(): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
        registerDecorator({
            name: 'calendarDate',
            target: target.constructor,
            propertyName: propertyName as string,
            options: { message: '$property must be a valid YYYY-MM-DD date' },
            validator: { validate: isCalendarDate },
        });
    };
}

/** Money columns keep two decimals. */
function twoDecimalPlaces(): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
        registerDecorator({
            name: 'twoDecimalPlaces',
            target: target.constructor,
            propertyName: propertyName as string,
            options: { message: '$property must have at most two decimal places' },
            validator: {
                validate: (value: unknown) =>
                    typeof value === 'number' &&
                    Number.isFinite(value) &&
                    Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
            },
        });
    };
}

function stockRule(
    name: string,
    message: string,
    isValid: (dto: StockEntryDto) => boolean,
): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
        registerDecorator({
            name,
            target: target.constructor,
            propertyName: propertyName as string,
            options: { message },
            validator: {
                validate: (_value: unknown, args: ValidationArguments): boolean =>
                    isValid(args.object as StockEntryDto),
            },
        });
    };
}

export class SupplierDto implements SupplierPayload {
    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    name: string;
}

export class StockEntryItemDto implements StockEntryItemPayload {
    @IsUUID('4')
    productId: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    quantity: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @twoDecimalPlaces()
    unitPrice: number;
}

export class StockEntryDto implements StockEntryPayload {
    @Transform(trimString)
    @IsString()
    @calendarDate()
    date: string;

    @IsUUID('4')
    supplierId: string;

    @IsArray()
    @ArrayNotEmpty()
    @stockRule(
        'uniqueStockProducts',
        'A product can appear only once in a stock entry.',
        (dto) => {
            if (!Array.isArray(dto.items)) return true;
            const ids = dto.items.map((item) => item?.productId);
            return new Set(ids).size === ids.length;
        },
    )
    @ValidateNested({ each: true })
    @Type(() => StockEntryItemDto)
    items: StockEntryItemDto[];
}

/** Query-string filters; `month` and `year` arrive as strings. */
export class StockEntryFilterDto implements StockEntryFilter {
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1900)
    @Max(9999)
    year?: number;

    @Transform(trimString)
    @IsOptional()
    @IsUUID('4')
    productId?: string;

    @Transform(trimString)
    @IsOptional()
    @IsUUID('4')
    supplierId?: string;
}
