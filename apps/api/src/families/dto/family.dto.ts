import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import type { FamilyPayload } from '@repo/types';

const trimString = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

export class FamilyDto implements FamilyPayload {
    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @Length(1, 100)
    name: string;

    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @Length(1, 50)
    @Matches(/^[a-zA-Z0-9_-]+$/)
    ref: string;

    @Transform(trimString)
    @IsOptional()
    @IsString()
    description?: string | null;
}
