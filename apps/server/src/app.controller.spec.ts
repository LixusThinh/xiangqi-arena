import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  it('reports health only after PostgreSQL responds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    const controller = new AppController(prisma);

    await expect(controller.health()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not return a healthy response when PostgreSQL is unavailable', async () => {
    const databaseError = new Error('database unavailable');
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(databaseError),
    } as unknown as PrismaService;
    const controller = new AppController(prisma);

    await expect(controller.health()).rejects.toBe(databaseError);
  });
});
