import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsISO8601,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    registerDecorator,
    ValidateNested,
    ValidationArguments,
} from 'class-validator';
import { OFFER_TYPES } from '../entities/offer.entity.js';
import { SINGLE_OFFER_MODES } from '../entities/offer-single-rule.entity.js';
import type { OfferPayload, SingleRulePayload } from '@repo/types';

const trimString = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

function offerRule(name: string, message: string, isValid: (dto: OfferDto) => boolean): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
        registerDecorator({
            name,
            target: target.constructor,
            propertyName: propertyName as string,
            options: { message },
            validator: {
                validate: (_value: unknown, args: ValidationArguments): boolean =>
                    isValid(args.object as OfferDto),
            },
        });
    };
}

export class OfferSingleRuleDto {
    @IsUUID('4')
    productId: string;

    @IsIn(SINGLE_OFFER_MODES)
    mode: SingleRulePayload['mode'];

    @Type(() => Number)
    @IsInt()
    @Min(1)
    buyQuantity: number;

    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    freeQuantity?: number | null;
}

export class OfferPackItemDto {
    @IsUUID('4')
    productId: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    quantity: number;
}

export class OfferDto implements OfferPayload {
    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    name: string;

    @IsIn(OFFER_TYPES)
    type: OfferPayload['type'];

    @IsBoolean()
    isActive: boolean;

    @IsOptional()
    @IsISO8601()
    startsAt?: string | null;

    @IsOptional()
    @IsISO8601()
    endsAt?: string | null;

    @Type(() => Number)
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    packPrice?: number | null;

    @IsOptional()
    @ValidateNested()
    @Type(() => OfferSingleRuleDto)
    singleRule?: OfferSingleRuleDto | null;

    // An empty array is valid for SINGLE_PRODUCT offers (the dashboard sends
    // one); the shape rule below enforces at least one item for PACK offers.
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OfferPackItemDto)
    packItems?: OfferPackItemDto[];

    @offerRule(
        'offerShape',
        'SINGLE_PRODUCT offers need one rule; PACK offers need a price and at least one item.',
        (dto) => {
            if (dto.type === 'SINGLE_PRODUCT') {
                return Boolean(dto.singleRule) && !dto.packPrice && (dto.packItems?.length ?? 0) === 0;
            }
            return (
                dto.type === 'PACK' &&
                typeof dto.packPrice === 'number' &&
                !dto.singleRule &&
                (dto.packItems?.length ?? 0) > 0
            );
        },
    )
    shapeValid?: boolean;

    @offerRule(
        'offerSingleRuleShape',
        'BUY_X_GET_Y_FREE needs freeQuantity; BUY_X_GET_FREE_SHIPPING must not have one.',
        (dto) => {
            const rule = dto.singleRule;
            if (!rule) return true;
            return rule.mode === 'BUY_X_GET_Y_FREE'
                ? typeof rule.freeQuantity === 'number' && rule.freeQuantity > 0
                : rule.freeQuantity === undefined || rule.freeQuantity === null;
        },
    )
    singleRuleShapeValid?: boolean;
}
