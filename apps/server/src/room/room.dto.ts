import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { HostColorPref, RoomVisibility } from '@prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRoomDto {
  /** Bỏ trống → "Phòng của <tên hiển thị>". */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(RoomVisibility)
  visibility?: RoomVisibility;

  @IsOptional()
  @IsEnum(HostColorPref)
  hostColorPref?: HostColorPref;

  /** Mã RuleProfile (seed: VN_STANDARD, ONLINE_RAPID). Bỏ trống → VN_STANDARD. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Z0-9_]{1,40}$/)
  ruleProfileCode?: string;
}
