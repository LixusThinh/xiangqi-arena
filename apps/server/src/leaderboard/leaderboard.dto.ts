import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const LEADERBOARD_DEFAULT_PAGE_SIZE = 20;
export const LEADERBOARD_MAX_PAGE_SIZE = 50;

export class LeaderboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LEADERBOARD_MAX_PAGE_SIZE)
  pageSize?: number;
}
