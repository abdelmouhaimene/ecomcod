import {
  BadRequestException,
  CallHandler,
  Controller,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AdminRole, type UploadImageResponse } from '@repo/types';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { catchError, from, switchMap, type Observable } from 'rxjs';
import { Roles } from '../admins/decorators/roles.decorator.js';
import { AdminGuard } from '../admins/guards/admin.guard.js';
import { IMAGE_EXTENSIONS, MAX_IMAGE_BYTES, UploadService } from './upload.service.js';

/** Normalizes multer's own errors into the API's 400 responses. */
@Injectable()
class ImageUploadInterceptor implements NestInterceptor {
  private readonly fileInterceptor = new (FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    fileFilter: (_request, file, callback) => {
      if (!IMAGE_EXTENSIONS[file.mimetype]) {
        callback(new BadRequestException('Only JPEG, PNG, WebP and GIF images are allowed.'), false);
        return;
      }
      callback(null, true);
    },
  }))();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.fileInterceptor.intercept(context, next)).pipe(
      switchMap((result) => result),
      catchError((error: unknown) => {
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
          throw new BadRequestException('Image must be 5 MB or smaller.');
        }
        throw error;
      }),
    );
  }
}

@Controller({ path: 'admin/uploads', version: '1' })
@UseGuards(AdminGuard)
@Roles(AdminRole.SYSTEM, AdminRole.MANAGER)
export class UploadController {
  constructor(private readonly uploads: UploadService) { }

  @Post()
  @UseInterceptors(ImageUploadInterceptor)
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('kind') kind?: string,
  ): Promise<UploadImageResponse> {
    return this.uploads.save(file, kind);
  }
}
