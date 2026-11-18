import { BadRequestException, Injectable } from '@nestjs/common';
import type { UploadImageResponse } from '@repo/types';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** MIME types accepted for catalog images, with their file extension. */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

@Injectable()
export class UploadService {
  private readonly directory = path.resolve(process.cwd(), 'uploads');

  async save(file: Express.Multer.File | undefined): Promise<UploadImageResponse> {
    if (!file?.buffer) {
      throw new BadRequestException('An image file is required.');
    }

    const extension = IMAGE_EXTENSIONS[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Only JPEG, PNG, WebP and GIF images are allowed.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 5 MB or smaller.');
    }

    const filename = `${randomUUID()}.${extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(path.join(this.directory, filename), file.buffer);
    return { url: `/uploads/${filename}` };
  }
}
