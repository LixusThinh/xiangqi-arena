import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  avatarUrl?: string | null;

  @IsOptional()
  bio?: string | null;
}
