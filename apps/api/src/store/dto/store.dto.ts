import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsEmail,
    IsIn,
    IsOptional,
    IsString,
    IsUrl,
    MaxLength,
    MinLength,
    ValidateNested,
    registerDecorator,
    type ValidationArguments,
    type ValidationOptions,
} from 'class-validator';
import {
    SOCIAL_PLATFORMS,
    parseYouTubeVideoId,
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

/** Accepts an empty value or a link from which a YouTube video id can be read. */
function IsYouTubeVideoUrl(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            name: 'isYouTubeVideoUrl',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(value: unknown) {
                    return (
                        typeof value === 'string' &&
                        (value.trim() === '' || parseYouTubeVideoId(value) !== null)
                    );
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} must be a valid YouTube video URL`;
                },
            },
        });
    };
}

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

    @IsOptional()
    @IsBoolean()
    homeVideoEnabled?: boolean;

    @IsOptional()
    @Transform(blankToEmpty)
    @IsString()
    @MaxLength(500)
    @IsYouTubeVideoUrl()
    homeVideoUrl?: string;

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
