import { Transform, Type } from 'class-transformer';
import {
    ArrayNotEmpty,
    IsArray,
    IsEmail,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    Matches,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    registerDecorator,
    ValidateNested,
} from 'class-validator';
import { ORDER_SOURCES } from '../entities/order.entity.js';
import type { OrderPayload } from '@repo/types';

const trimString = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

/** Local, `+213` and `00213` Algerian mobile numbers are accepted. */
const ALGERIAN_PHONE_PATTERN = /^(?:0[567]\d{8}|\+213[567]\d{8}|00213[567]\d{8})$/;

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

function uniqueOffers(): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
        registerDecorator({
            name: 'uniqueOffers',
            target: target.constructor,
            propertyName: propertyName as string,
            options: { message: 'An offer can be applied only once per order.' },
            validator: {
                validate: (value: unknown) => {
                    if (!Array.isArray(value)) return true;
                    const ids = value.map((offer: AppliedOfferDto) => offer?.offerId);
                    return new Set(ids).size === ids.length;
                },
            },
        });
    };
}

export class OrderItemDto {
    @IsUUID('4')
    skuId: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    quantity: number;
}

export class AppliedOfferSelectionDto {
    @IsUUID('4')
    productId: string;

    @IsUUID('4')
    skuId: string;

    /** Units covered by this SKU. A single legacy selection covers all units. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    quantity?: number;
}

export class AppliedOfferDto {
    @IsUUID('4')
    offerId: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    times: number;

    /** One choice per unit; several entries for one product are allowed. */
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => AppliedOfferSelectionDto)
    selections: AppliedOfferSelectionDto[];
}

export class OrderDto implements OrderPayload {
    @IsIn(ORDER_SOURCES)
    source: OrderPayload['source'];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];

    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @uniqueOffers()
    @ValidateNested({ each: true })
    @Type(() => AppliedOfferDto)
    offers?: AppliedOfferDto[];

    @Transform(trimString)
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    customerName?: string | null;

    @Transform(trimString)
    @IsOptional()
    @IsEmail()
    @MaxLength(200)
    customerEmail?: string | null;

    @Transform(trimString)
    @IsOptional()
    @Matches(ALGERIAN_PHONE_PATTERN, {
        message: 'customerPhone must be a valid Algerian mobile number',
    })
    customerPhone?: string | null;

    @Transform(trimString)
    @IsOptional()
    @Matches(/^\d{2}$/, { message: 'wilayaCode must be a two-digit code' })
    wilayaCode?: string | null;

    @Transform(trimString)
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    wilayaName?: string | null;

    @Transform(trimString)
    @IsOptional()
    @Matches(/^\d{4}$/, { message: 'communeCode must be a four-digit code' })
    communeCode?: string | null;

    @Transform(trimString)
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    communeName?: string | null;

    @Transform(trimString)
    @IsOptional()
    @IsString()
    notes?: string | null;

    @Type(() => Number)
    @IsOptional()
    @IsNumber()
    @Min(0)
    @twoDecimalPlaces()
    baseShippingCost?: number;

    @Type(() => Number)
    @IsOptional()
    @IsNumber()
    @Min(0)
    @twoDecimalPlaces()
    taxAmount?: number;
}
