import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { UploadService } from './upload.service.js';

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadService],
    }).compile();
    service = module.get<UploadService>(UploadService);
  });

  it('writes an image under the uploads directory and returns its URL', async () => {
    const file = {
      mimetype: 'image/png',
      size: 4,
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    } as Express.Multer.File;

    const result = await service.save(file);

    expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    const saved = path.resolve(process.cwd(), result.url.replace(/^\//, ''));
    await unlink(saved);
  });

  it('rejects unsupported MIME types and missing files', async () => {
    const mime = await rejected(service.save({
      mimetype: 'text/plain',
      size: 4,
      buffer: Buffer.from('text'),
    } as Express.Multer.File));
    expect(mime).toBeInstanceOf(BadRequestException);
    expect((mime as Error).message).toBe('Only JPEG, PNG, WebP and GIF images are allowed.');

    const missing = await rejected(service.save(undefined));
    expect(missing).toBeInstanceOf(BadRequestException);
  });

  it('enforces the 5 MB limit', async () => {
    const error = await rejected(service.save({
      mimetype: 'image/jpeg',
      size: 5 * 1024 * 1024 + 1,
      buffer: Buffer.alloc(1),
    } as Express.Multer.File));

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toBe('Image must be 5 MB or smaller.');
  });
});
