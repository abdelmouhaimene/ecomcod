import { Transform, Type } from 'class-transformer';
import {
    ArrayNotEmpty,
    IsArray,
    IsEmail,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
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

function uniqueSelectionProducts(): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
        registerDecorator({
            name: 'uniqueSelectionProducts',
            target: target.constructor,
            propertyName: propertyName as string,
            options: { message: 'A product can be selected only once per offer.' },
            validator: {
                validate: (value: unknown) => {
                    if (!Array.isArray(value)) return true;
                    const ids = value.map((selection: AppliedOfferSelectionDto) => selection?.productId);
                    return new Set(ids).size === ids.length;
                },
            },
        });
    };
}

export class AppliedOfferSelectionDto {
    @IsUUID('4')
    productId: string;

    @IsUUID('4')
    skuId: string;
}

export class AppliedOfferDto {
    @IsUUID('4')
    offerId: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    times: number;

    /** One variant choice per product in the offer; the API never guesses. */
    @IsArray()
    @ArrayNotEmpty()
    @uniqueSelectionProducts()
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
