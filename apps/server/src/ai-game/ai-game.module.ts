import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiGameController } from './ai-game.controller';
import { AiGameService } from './ai-game.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AiGameController],
  providers: [AiGameService],
  exports: [AiGameService],
})
export class AiGameModule {}
