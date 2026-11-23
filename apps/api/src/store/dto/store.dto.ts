import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsEmail,
    IsIn,
    IsString,
    IsUrl,
    MaxLength,
    MinLength,
    ValidateNested,
} from 'class-validator';
import {
    SOCIAL_PLATFORMS,
    type SocialPlatform,
    type StoreInfoPayload,
} from '@repo/types';

const trim = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

/** Optional text fields are stored as empty strings, not nulls. */
const blankToEmpty = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' && value.trim() === '' ? '' : value;

const trimEach = ({ value }: { value: unknown }): unknown =>
    Array.isArray(value)
        ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
        : value;

export class StoreSocialLinkDto {
    @IsIn(SOCIAL_PLATFORMS)
    platform: SocialPlatform;

    @Transform(trim)
    @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
    @MaxLength(500)
    url: string;
}

/** Whole-store update: settings plus the full replacement contact lists. */
export class StoreInfoDto implements StoreInfoPayload {
    @Transform(trim)
    @IsString()
    @MinLength(1)
    @MaxLength(150)
    name: string;

    @Transform(trim)
    @IsString()
    @MaxLength(2000)
    description: string;

    @Transform(blankToEmpty)
    @IsString()
    @MaxLength(500)
    logo: string;

    @Transform(trim)
    @IsEmail()
    @MaxLength(200)
    email: string;

    @Transform(blankToEmpty)
    @IsString()
    @MaxLength(300)
    website: string;

    @Transform(trim)
    @IsString()
    @MaxLength(300)
    address: string;

    @Transform(trim)
    @IsString()
    @MaxLength(500)
    mapQuery: string;

    @Transform(trimEach)
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
    @MinLength(1, { each: true })
    @MaxLength(50, { each: true })
    phones: string[];

    @IsArray()
    @ArrayMaxSize(SOCIAL_PLATFORMS.length)
    @ValidateNested({ each: true })
    @Type(() => StoreSocialLinkDto)
    socialLinks: StoreSocialLinkDto[];
}
