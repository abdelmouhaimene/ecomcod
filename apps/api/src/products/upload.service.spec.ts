import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { UploadService } from './upload.service.js';

type SharpMetadata = Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

function pngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
}

function asFile(buffer: Buffer, mimetype = 'image/png'): Express.Multer.File {
  return { mimetype, size: buffer.length, buffer } as Express.Multer.File;
}

describe('UploadService', () => {
  let service: UploadService;
  const savedFiles: string[] = [];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadService],
    }).compile();
    service = module.get<UploadService>(UploadService);
  });

  afterEach(async () => {
    await Promise.all(savedFiles.splice(0).map((file) => unlink(file)));
  });

  async function metadataFor(url: string): Promise<SharpMetadata> {
    const saved = path.resolve(process.cwd(), url.replace(/^\//, ''));
    savedFiles.push(saved);
    return sharp(await readFile(saved)).metadata();
  }

  it('resizes and converts product images to WebP', async () => {
    const result = await service.save(asFile(await pngBuffer(2000, 1000)), 'product');

    expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/);
    const metadata = await metadataFor(result.url);
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
  });

  it('uses a smaller size for category icons', async () => {
    const result = await service.save(asFile(await pngBuffer(800, 800)), 'category-icon');

    const metadata = await metadataFor(result.url);
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
  });

  it('keeps the original logo dimensions while converting to WebP', async () => {
    const result = await service.save(asFile(await pngBuffer(1200, 600)), 'logo');

    const metadata = await metadataFor(result.url);
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(600);
  });

  it('rejects unsupported MIME types, invalid images and missing files', async () => {
    const mime = await rejected(service.save(asFile(Buffer.from('text'), 'text/plain')));
    expect(mime).toBeInstanceOf(BadRequestException);
    expect((mime as Error).message).toBe('Only JPEG, PNG, WebP and GIF images are allowed.');

    const invalid = await rejected(service.save(asFile(Buffer.from('not an image'))));
    expect(invalid).toBeInstanceOf(BadRequestException);
    expect((invalid as Error).message).toBe('The file is not a valid image.');

    const missing = await rejected(service.save(undefined));
    expect(missing).toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown upload kinds and oversized files', async () => {
    const kind = await rejected(service.save(asFile(await pngBuffer(10, 10)), 'avatar'));
    expect(kind).toBeInstanceOf(BadRequestException);
    expect((kind as Error).message).toBe('Unsupported image type.');

    const size = await rejected(service.save({
      mimetype: 'image/jpeg',
      size: 5 * 1024 * 1024 + 1,
      buffer: Buffer.alloc(1),
    } as Express.Multer.File));
    expect(size).toBeInstanceOf(BadRequestException);
    expect((size as Error).message).toBe('Image must be 5 MB or smaller.');
  });
});
