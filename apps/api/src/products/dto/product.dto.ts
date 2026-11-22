import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidateNested,
} from 'class-validator';
import { SIZE_TEXT_VALUES, VARIANT_TYPES } from '../entities/product-variant.entity.js';
import type {
  ProductImagePayload,
  ProductPayload,
  ProductVariantPayload,
} from '@repo/types';

/** Trim before validation so whitespace-only values are rejected. */
const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Cross-field rules; they read the whole payload from ValidationArguments. */
function productRule(name: string, message: string, isValid: (dto: ProductDto) => boolean): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message },
      validator: {
        validate: (_value: unknown, args: ValidationArguments): boolean =>
          isValid(args.object as ProductDto),
      },
    });
  };
}

function dimensionKey(variant: Pick<ProductVariantDto, 'variantType' | 'name'>): string {
  return variant.variantType === 'OTHER'
    ? `OTHER:${(variant.name ?? '').trim().toLowerCase()}`
    : variant.variantType;
}

function valueKey(variantType: string, value: string): string {
  return variantType === 'SIZE_TEXT' ? value.trim().toUpperCase() : value.trim();
}

/** Type-specific rules need the parent variant's `variantType`. */
function variantValues(): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'variantValues',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: 'Invalid value for this variant type' },
      validator: {
        validate: (values: unknown, args: ValidationArguments): boolean => {
          const variant = args.object as ProductVariantDto;
          if (!Array.isArray(values)) return true;
          return values.every((value) => {
            if (!value || typeof value.value !== 'string') return false;
            const text = value.value.trim();
            if (text.length === 0) return false;
            if (variant.variantType === 'SIZE_TEXT') {
              return SIZE_TEXT_VALUES.includes(text.toUpperCase() as never);
            }
            if (variant.variantType === 'SIZE_NUM') {
              return /^\d+(\.\d{1,2})?$/.test(text);
            }
            if (variant.variantType === 'COLOR') {
              return typeof value.hexColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.hexColor.trim());
            }
            return value.hexColor === undefined || value.hexColor === null;
          });
        },
      },
    });
  };
}

function oneDecimalPlace(): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'oneDecimalPlace',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: '$property must have at most one decimal place' },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'number' &&
          Number.isFinite(value) &&
          Math.abs(value * 10 - Math.round(value * 10)) < 1e-9,
      },
    });
  };
}

export class ProductImageDto implements ProductImagePayload {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  key: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url: string;

  @IsBoolean()
  isMain: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  position: number;
}

export class ProductVariantValueDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  key?: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  value: string;

  /** Required for `COLOR`; `null` for every other variant type. */
  @Transform(trimString)
  @IsOptional()
  hexColor?: string | null;

  /** Optional; when provided it must reference one of the product's images. */
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  imageKey?: string | null;
}

export class ProductVariantDto implements ProductVariantPayload {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  key?: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(trimString)
  @IsIn(VARIANT_TYPES)
  variantType: ProductVariantPayload['variantType'];

  @IsArray()
  @ArrayNotEmpty()
  @variantValues()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantValueDto)
  values: ProductVariantValueDto[];
}

/** Full replacement payload used by both POST and PUT. */
export class ProductDto implements ProductPayload {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ref: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subtitle?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  oldPrice?: number | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  @oneDecimalPlace()
  fakeReviews: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  @oneDecimalPlace()
  realReviews: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  fakeSolds: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  realSolds: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  categoryIds: string[];

  /** Optional so existing category-only payloads keep working. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  familyIds?: string[];

  @IsArray()
  @ArrayNotEmpty()
  @productRule(
    'exactlyOneMainImage',
    'Exactly one image must be marked as main.',
    (dto) => Array.isArray(dto.images) && dto.images.filter((image) => image?.isMain === true).length === 1,
  )
  @productRule(
    'uniqueImageKeys',
    'Image keys must be unique.',
    (dto) => {
      if (!Array.isArray(dto.images)) return true;
      const keys = dto.images.map((image) => image?.key);
      return new Set(keys).size === keys.length;
    },
  )
  @productRule(
    'uniqueImageUrls',
    'Image URLs must be unique.',
    (dto) => {
      if (!Array.isArray(dto.images)) return true;
      const urls = dto.images.map((image) => image?.url);
      return new Set(urls).size === urls.length;
    },
  )
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images: ProductImageDto[];

  @IsArray()
  @productRule(
    'uniqueVariantKeys',
    'Variant keys must be unique when provided.',
    (dto) => {
      if (!Array.isArray(dto.variants)) return true;
      const keys = dto.variants
        .map((variant) => variant?.key)
        .filter((key): key is string => typeof key === 'string' && key.length > 0);
      return new Set(keys).size === keys.length;
    },
  )
  @productRule(
    'uniqueVariantDimensions',
    'Only one variant is allowed per variant type (or custom name).',
    (dto) => {
      if (!Array.isArray(dto.variants)) return true;
      const keys = dto.variants.map((variant) => dimensionKey(variant));
      return new Set(keys).size === keys.length;
    },
  )
  @productRule(
    'uniqueVariantValueKeys',
    'Variant value keys must be unique within a variant.',
    (dto) => {
      if (!Array.isArray(dto.variants)) return true;
      return dto.variants.every((variant) => {
        const keys = (variant?.values ?? [])
          .map((value) => value?.key)
          .filter((key): key is string => typeof key === 'string' && key.length > 0);
        return new Set(keys).size === keys.length;
      });
    },
  )
  @productRule(
    'uniqueVariantValues',
    'Variant values must be unique within a variant.',
    (dto) => {
      if (!Array.isArray(dto.variants)) return true;
      return dto.variants.every((variant) => {
        const values = (variant?.values ?? []).map((value) =>
          valueKey(variant?.variantType ?? '', value?.value ?? ''),
        );
        return new Set(values).size === values.length;
      });
    },
  )
  @productRule(
    'variantImageKeys',
    'Each variant value imageKey must reference an image in this product.',
    (dto) => {
      if (!Array.isArray(dto.images) || !Array.isArray(dto.variants)) return true;
      const keys = new Set(dto.images.map((image) => image?.key));
      return dto.variants.every((variant) =>
        (variant?.values ?? []).every(
          (value) => !value?.imageKey || keys.has(value.imageKey),
        ),
      );
    },
  )
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants: ProductVariantDto[];
}
