import { INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { InMemoryPrisma } from './in-memory-prisma';

export const TEST_JWT_SECRET = 'e2e-test-access-token-secret-at-least-32-bytes';
export const TEST_WEB_ORIGIN = 'http://localhost:3001';

export interface TestApp {
  app: INestApplication;
  /** HTTP server có kiểu rõ ràng để truyền cho supertest (getHttpServer() trả về any). */
  server: Server;
  prisma: InMemoryPrisma;
  close(): Promise<void>;
}

/**
 * Dựng toàn bộ AppModule như production (pipe, filter, CORS, guard thật) nhưng thay PostgreSQL
 * bằng InMemoryPrisma. Mỗi lời gọi tạo một DB rỗng riêng → các test không ảnh hưởng nhau.
 */
export async function createTestApp(): Promise<TestApp> {
  process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
  const prisma = new InMemoryPrisma();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, TEST_WEB_ORIGIN);
  await app.init();
  return {
    app,
    server: app.getHttpServer() as Server,
    prisma,
    close: () => app.close(),
  };
}

/** Thêm sẵn một user vào DB giả (mật khẩu bcrypt cost 4 cho test nhanh). */
export async function seedUser(
  prisma: InMemoryPrisma,
  overrides: Partial<{ username: string; email: string; password: string; displayName: string }> = {},
): Promise<{ id: bigint; username: string; email: string; password: string }> {
  const username = overrides.username ?? 'player1';
  const email = overrides.email ?? `${username}@xiangqi.local`;
  const password = overrides.password ?? 'Player-dev-2026!';
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await hash(password, 4),
      displayName: overrides.displayName ?? username,
    },
  });
  return { id: user.id as bigint, username, email, password };
}
