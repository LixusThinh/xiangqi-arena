import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { AiGameLevel, AiGameStatus } from '@prisma/client';

export class CreateAiGameDto {
  @IsEnum(AiGameLevel)
  level: AiGameLevel;

  @IsIn(['r', 'b'])
  playerColor: 'r' | 'b';
}

export class AiGameMoveDto {
  @IsString()
  @Matches(/^[a-i][0-9]$/)
  from: string;

  @IsString()
  @Matches(/^[a-i][0-9]$/)
  to: string;
}

export class UpdateAiGameDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiGameMoveDto)
  moves: AiGameMoveDto[];

  @IsOptional()
  @IsEnum(AiGameStatus)
  status?: AiGameStatus;

  @IsOptional()
  @IsString()
  result?: string;
}

export class ListAiGameQueryDto {
  @IsOptional()
  @IsEnum(AiGameStatus)
  status?: AiGameStatus;
}
