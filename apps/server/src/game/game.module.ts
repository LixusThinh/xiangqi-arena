import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClockService } from './clock.service';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { PresenceService } from './presence.service';

@Module({
  imports: [AuthModule],
  controllers: [GameController],
  providers: [GameService, GameGateway, PresenceService, ClockService],
  exports: [GameService],
})
export class GameModule {}
