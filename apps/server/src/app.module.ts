import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AiGameModule } from './ai-game/ai-game.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { GameModule } from './game/game.module';
import { HistoryModule } from './history/history.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoomModule } from './room/room.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UserModule,
    RoomModule,
    GameModule,
    HistoryModule,
    LeaderboardModule,
    AdminModule,
    AiGameModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
