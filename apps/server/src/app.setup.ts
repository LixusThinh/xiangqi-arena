import { BadRequestException, INestApplication, INestApplicationContext, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { ApiExceptionFilter } from './api-exception.filter';

/** Socket.IO dùng cùng danh sách origin với REST (XQA-75). */
class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, { ...options, cors: { origin: this.origins } });
  }
}

/**
 * Cấu hình dùng chung cho main.ts và test e2e, để test chạy đúng pipe/filter/CORS như production.
 */
export function configureApp(app: INestApplication, webOrigins = process.env.WEB_ORIGINS): void {
  // Web (Next.js) chạy ở origin khác cổng API → phải bật CORS, nếu không trình duyệt chặn mọi request.
  const origins = parseWebOrigins(webOrigins);
  app.enableCors({ origin: origins });
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors.map((error) => ({
            field: error.property,
            message: Object.values(error.constraints ?? {}).join(', '),
          })),
        }),
    }),
  );
}

/** WEB_ORIGINS: danh sách origin cách nhau dấu phẩy. Mặc định là web dev ở cổng 3001. */
export function parseWebOrigins(value: string | undefined): string[] {
  const origins = (value ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
  if (origins.includes('*')) {
    throw new Error('WEB_ORIGINS must list explicit origins; "*" is not allowed');
  }
  return origins;
}
