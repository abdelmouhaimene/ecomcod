import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Standardizes every error response to a single shape so the web client can
 * always read `message` (string) regardless of the underlying exception.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : (rawMessage as { message?: unknown })?.message ?? 'Internal server error';

    const normalizedMessage = Array.isArray(message) ? message.join(' ') : String(message);

    response.status(status).json({
      statusCode: status,
      message: normalizedMessage,
      error: exception instanceof HttpException ? exception.name : 'InternalServerError',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}