import { IsInt, Matches, Min } from 'class-validator';

export class MoveDto {
  @Matches(/^[a-i][0-9]$/)
  from!: string;

  @Matches(/^[a-i][0-9]$/)
  to!: string;

  @IsInt()
  @Min(0)
  expectedPly!: number;
}
