import { Transform } from 'class-transformer';
import {
    IsNotEmpty,
    IsString,
    Matches,
    MaxLength,
} from 'class-validator';
import type { UpdateProfilePayload } from '@repo/types';

const trimString = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

/** Stores the local `0xxxxxxxxx` form whatever the client sends. */
const normalizeAlgerianPhone = ({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') return value;

    const compact = value.replace(/[\s().-]/g, '');
    if (/^0[567]\d{8}$/.test(compact)) return compact;

    const international = compact.replace(/^00213/, '+213');
    if (/^\+213[567]\d{8}$/.test(international)) {
        return `0${international.slice(4)}`;
    }
    if (/^213[567]\d{8}$/.test(compact)) {
        return `0${compact.slice(3)}`;
    }
    return compact;
};

export class UpdateProfileDto implements UpdateProfilePayload {
    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    fullName: string;

    @Transform(normalizeAlgerianPhone)
    @Matches(/^0[567]\d{8}$/, {
        message: 'phoneNumber must be a valid Algerian mobile number',
    })
    phoneNumber: string;

    @Transform(trimString)
    @IsString()
    @Matches(/^\d{2}$/, { message: 'wilayaCode must be a two-digit code' })
    wilayaCode: string;

    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    wilayaName: string;

    @Transform(trimString)
    @IsString()
    @Matches(/^\d{4}$/, { message: 'communeCode must be a four-digit code' })
    communeCode: string;

    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    communeName: string;
}
