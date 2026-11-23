import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { CreateAdminCommentPayload, CreateCommentPayload } from '@repo/types';

const trim = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

const trimImage = ({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
};

/** Verified-user comment: author identity comes from the session, not the body. */
export class CreateCommentDto implements CreateCommentPayload {
    @Transform(trim)
    @IsString()
    @MinLength(3)
    @MaxLength(1000)
    content: string;

    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;
}

/** Admin fake comment: username/image are supplied manually. */
export class AdminCommentDto implements CreateAdminCommentPayload {
    @Transform(trim)
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    username: string;

    @Transform(trimImage)
    @IsOptional()
    @IsString()
    @MaxLength(500)
    userImage?: string | null;

    @Transform(trim)
    @IsString()
    @MinLength(3)
    @MaxLength(1000)
    content: string;

    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;
}
