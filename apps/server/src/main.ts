import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
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

  const config = app.get(ConfigService);
  const portValue = config.get<string>('PORT', '3000');
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer from 1 to 65535; received "${portValue}"`);
  }

  await app.listen(port);
}

void bootstrap();
