import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
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
  ValidationArguments,
  ValidateNested,
} from 'class-validator';
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

/** Ratings are stored with one decimal place, e.g. 4.5. */
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
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  value: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  imageKey: string;
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
    'variantImageKeys',
    'Each variant imageKey must reference an image in this product.',
    (dto) => {
      if (!Array.isArray(dto.images) || !Array.isArray(dto.variants)) return true;
      const keys = new Set(dto.images.map((image) => image?.key));
      return dto.variants.every(
        (variant) => typeof variant?.imageKey === 'string' && keys.has(variant.imageKey),
      );
    },
  )
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants: ProductVariantDto[];
}
