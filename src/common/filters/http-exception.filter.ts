import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '../interfaces/response.interface';

/**
 * Global hata filtresi. docs/04 ExceptionHandlingMiddleware karşılığı:
 * - ValidationException → 400 { success:false, message, errors }
 * - Bilinen domain hataları (NotFound/Forbidden/Conflict...) → status korunur
 * - Diğeri → 500
 * Mevcut status code'lar (400/401/403/404/409) birebir korunur.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, errors } = this.extract(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponse = {
      success: false,
      message,
      ...(errors !== undefined ? { errors } : {}),
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private extract(exception: unknown): { message: string; errors?: unknown } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { message: res };
      }
      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        const rawMessage = r.message;
        // class-validator: message bir string[] olabilir → errors'a koy
        if (Array.isArray(rawMessage)) {
          return { message: 'Validation failed', errors: rawMessage };
        }
        return {
          message:
            typeof rawMessage === 'string' ? rawMessage : exception.message,
        };
      }
    }
    return { message: 'Internal server error' };
  }
}
