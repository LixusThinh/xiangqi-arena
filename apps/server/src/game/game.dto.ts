import { IsEnum, IsInt, IsOptional, Matches, MaxLength, Min } from 'class-validator';
import { ReportReason } from '@prisma/client';

export class MoveDto {
  @Matches(/^[a-i][0-9]$/)
  from!: string;

  @Matches(/^[a-i][0-9]$/)
  to!: string;

  @IsInt()
  @Min(0)
  expectedPly!: number;
}

export class CreateReportDto {
  @IsEnum(ReportReason, { message: 'Lý do báo cáo không hợp lệ' })
  reason!: ReportReason;

  @IsOptional()
  @MaxLength(500, { message: 'Mô tả không được vượt quá 500 ký tự' })
  description?: string;
}
