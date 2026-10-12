import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  try {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const testPassword = process.env.SEED_TEST_PASSWORD;
    if (!adminPassword || !testPassword) {
      throw new Error(
        'SEED_ADMIN_PASSWORD and SEED_TEST_PASSWORD must be set in apps/server/.env',
      );
    }

    const profiles = [
      {
        code: 'VN_STANDARD',
        baseTimeSec: 600,
        incrementSec: 0,
        naturalMoveLimit: 120,
        repetitionThreshold: 3,
        reconnectGraceSec: 60,
        isRanked: false,
      },
      {
        code: 'ONLINE_RAPID',
        baseTimeSec: 300,
        incrementSec: 2,
        naturalMoveLimit: 120,
        repetitionThreshold: 3,
        reconnectGraceSec: 60,
        isRanked: true,
      },
    ];
    for (const profile of profiles) {
      await prisma.ruleProfile.upsert({
        where: { code: profile.code },
        update: profile,
        create: profile,
      });
    }

    const accounts = [
      {
        username: 'admin',
        email: 'admin@xiangqi.local',
        displayName: 'Xiangqi Admin',
        role: UserRole.ADMIN,
        password: adminPassword,
      },
      {
        username: 'player1',
        email: 'player1@xiangqi.local',
        displayName: 'Test Player 1',
        role: UserRole.PLAYER,
        password: testPassword,
      },
      {
        username: 'player2',
        email: 'player2@xiangqi.local',
        displayName: 'Test Player 2',
        role: UserRole.PLAYER,
        password: testPassword,
      },
    ];

    for (const account of accounts) {
      const passwordHash = await hash(account.password, 12);
      await prisma.user.upsert({
        where: { username: account.username },
        update: {
          email: account.email,
          displayName: account.displayName,
          role: account.role,
          passwordHash,
        },
        create: {
          username: account.username,
          email: account.email,
          displayName: account.displayName,
          role: account.role,
          passwordHash,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
});
