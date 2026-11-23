import { BadRequestException, Injectable } from '@nestjs/common';
import type { UploadImageKind, UploadImageResponse } from '@repo/types';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type SharpInstance = ReturnType<typeof sharp>;
type SharpMetadata = Awaited<ReturnType<SharpInstance['metadata']>>;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000;

/** MIME types accepted for catalog images, with their file extension. */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

interface UploadProfile {
  /** `null` keeps the original dimensions (used for the store logo). */
  maxDimension: number | null;
  quality: number;
}

const UPLOAD_PROFILES: Record<UploadImageKind, UploadProfile> = {
  product: { maxDimension: 1600, quality: 82 },
  client: { maxDimension: 512, quality: 82 },
  gallery: { maxDimension: 1920, quality: 82 },
  'category-icon': { maxDimension: 256, quality: 82 },
  logo: { maxDimension: null, quality: 92 },
};

/** Accepts query values while keeping the internal API strongly typed. */
export function normalizeUploadKind(value: unknown): UploadImageKind {
  if (value === undefined || value === null || value === '') return 'product';
  if (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(UPLOAD_PROFILES, value)
  ) {
    return value as UploadImageKind;
  }
  throw new BadRequestException('Unsupported image type.');
}

@Injectable()
export class UploadService {
  private readonly directory = path.resolve(process.cwd(), 'uploads');

  async save(file: Express.Multer.File | undefined, kind: unknown = 'product'): Promise<UploadImageResponse> {
    if (!file?.buffer) {
      throw new BadRequestException('An image file is required.');
    }

    if (!IMAGE_EXTENSIONS[file.mimetype]) {
      throw new BadRequestException('Only JPEG, PNG, WebP and GIF images are allowed.');
    }
    if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 5 MB or smaller.');
    }

    const profile = UPLOAD_PROFILES[normalizeUploadKind(kind)];
    let image: SharpInstance;
    let metadata: SharpMetadata;
    try {
      image = sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
      metadata = await image.metadata();
    } catch {
      throw new BadRequestException('The file is not a valid image.');
    }

    if (
      !metadata.format ||
      !Object.prototype.hasOwnProperty.call(IMAGE_EXTENSIONS, `image/${metadata.format}`) ||
      !metadata.width ||
      !metadata.height ||
      metadata.width < 1 ||
      metadata.height < 1
    ) {
      throw new BadRequestException('The file is not a valid image.');
    }
    if ((metadata.pages ?? 1) > 1) {
      throw new BadRequestException('Animated images are not supported.');
    }

    if (profile.maxDimension) {
      image = image.resize({
        width: profile.maxDimension,
        height: profile.maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const output = await image.webp({ quality: profile.quality, effort: 4 }).toBuffer();
    const filename = `${randomUUID()}.webp`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(path.join(this.directory, filename), output);
    return { url: `/uploads/${filename}` };
  }
}
