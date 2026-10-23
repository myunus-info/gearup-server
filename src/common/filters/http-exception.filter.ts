import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let message: string = 'Internal server error';
    let errorSources: Array<{ path: string; message: string }> | undefined = undefined;

    // Translate TypeORM database errors to clean client HTTP statuses
    if (exception && typeof exception === 'object' && 'name' in exception && exception.name === 'QueryFailedError') {
      const err = exception as any;
      if (
        err.code === '23505' ||
        (err.message && (err.message.includes('UNIQUE') || err.message.includes('duplicate')))
      ) {
        status = HttpStatus.CONFLICT;
        message = 'Conflict: A record with unique field already exists';
      } else if (err.code === '23503' || (err.message && err.message.includes('FOREIGN KEY'))) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Foreign key constraint violation: referenced record does not exist or cannot be modified';
      }
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, any>;
      if (Array.isArray(resp.message)) {
        message = resp.message.join(', ');
        errorSources = resp.message.map((msg: string) => ({
          path: '',
          message: msg,
        }));
      } else if (typeof resp.message === 'string') {
        message = resp.message;
      }
    } else if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const isDevelopment = process.env.NODE_ENV !== 'production';

    const errorPayload = {
      success: false,
      statusCode: status,
      message,
      ...(errorSources ? { errorSources } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(isDevelopment && exception instanceof Error ? { stack: exception.stack } : {}),
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - Status: ${status} - Message: ${message}`);
    }

    response.status(status).json(errorPayload);
  }
}
