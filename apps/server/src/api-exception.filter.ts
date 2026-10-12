import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ApiErrorBody {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : 500;

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        'Unhandled request error',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = this.toErrorBody(statusCode, exceptionResponse);
    response.status(statusCode).json(body);
  }

  private toErrorBody(
    statusCode: number,
    exceptionResponse: string | object | undefined,
  ): ApiErrorBody {
    if (
      isRecord(exceptionResponse) &&
      typeof exceptionResponse.statusCode === 'number' &&
      typeof exceptionResponse.error === 'string' &&
      typeof exceptionResponse.code === 'string' &&
      typeof exceptionResponse.message === 'string'
    ) {
      return {
        statusCode,
        error: exceptionResponse.error,
        code: exceptionResponse.code,
        message: exceptionResponse.message,
        ...(Array.isArray(exceptionResponse.details)
          ? { details: exceptionResponse.details }
          : {}),
      };
    }

    const message =
      statusCode >= 500
        ? 'Internal server error'
        : isRecord(exceptionResponse) &&
            typeof exceptionResponse.message === 'string'
          ? exceptionResponse.message
          : typeof exceptionResponse === 'string'
            ? exceptionResponse
            : 'Request failed';

    return {
      statusCode,
      error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
      code:
        statusCode === 400
          ? 'VALIDATION_ERROR'
          : statusCode === 404
            ? 'NOT_FOUND'
            : statusCode >= 500
              ? 'INTERNAL_SERVER_ERROR'
              : 'HTTP_ERROR',
      message,
    };
  }
}
