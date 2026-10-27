import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const HISTORY_DEFAULT_PAGE_SIZE = 20;
export const HISTORY_MAX_PAGE_SIZE = 50;

export class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HISTORY_MAX_PAGE_SIZE)
  pageSize?: number;
}
