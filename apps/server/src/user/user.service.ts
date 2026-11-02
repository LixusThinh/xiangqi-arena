import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './user.dto';
import { UpdatedProfileResponse, UserProfileResponse } from './user.types';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy thông tin hồ sơ công khai của một người chơi theo username (FR-04).
   * Chỉ tính các ván có trạng thái FINISHED.
   */
  async getProfile(username: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'USER_NOT_FOUND',
        message: `Không tìm thấy người chơi '${username}'.`,
      });
    }

    // Lấy các ván đấu đã kết thúc (FINISHED) mà người này tham gia
    const matches = await this.prisma.match.findMany({
      where: {
        status: 'FINISHED',
        OR: [{ redPlayerId: user.id }, { blackPlayerId: user.id }],
      },
      select: {
        redPlayerId: true,
        blackPlayerId: true,
        result: true,
      },
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const match of matches) {
      if (match.result === 'DRAW') {
        draws++;
      } else if (match.result === 'RED_WIN') {
        if (match.redPlayerId === user.id) {
          wins++;
        } else {
          losses++;
        }
      } else if (match.result === 'BLACK_WIN') {
        if (match.blackPlayerId === user.id) {
          wins++;
        } else {
          losses++;
        }
      }
    }

    const totalMatches = matches.length;
    const winRate =
      totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;

    return {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      rating: user.rating,
      totalMatches,
      wins,
      losses,
      draws,
      winRate,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Cập nhật thông tin hồ sơ của người dùng hiện tại (FR-04).
   * Ràng buộc:
   * - displayName: 1–80 ký tự sau khi trim.
   * - bio: <= 500 ký tự (được rỗng).
   * - avatarUrl: rỗng, hoặc URL https:// <= 2048 ký tự.
   */
  async updateProfile(
    userIdStr: string,
    dto: UpdateProfileDto,
  ): Promise<UpdatedProfileResponse> {
    const userId = BigInt(userIdStr);

    // Kiểm tra displayName nếu được gửi
    if (dto.displayName !== undefined) {
      if (typeof dto.displayName !== 'string') {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Tên hiển thị không hợp lệ.',
          details: [{ field: 'displayName', message: 'Tên hiển thị phải là chuỗi ký tự.' }],
        });
      }
      const trimmed = dto.displayName.trim();
      if (trimmed.length < 1 || trimmed.length > 80) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Tên hiển thị phải từ 1 đến 80 ký tự sau khi bỏ khoảng trắng thừa.',
          details: [{ field: 'displayName', message: 'Độ dài tên hiển thị phải từ 1 đến 80 ký tự.' }],
        });
      }
    }

    // Kiểm tra bio nếu được gửi
    if (dto.bio !== undefined && dto.bio !== null) {
      if (typeof dto.bio !== 'string') {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Tiểu sử không hợp lệ.',
          details: [{ field: 'bio', message: 'Tiểu sử phải là chuỗi ký tự.' }],
        });
      }
      if (dto.bio.length > 500) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Tiểu sử không được vượt quá 500 ký tự.',
          details: [{ field: 'bio', message: 'Tiểu sử không được vượt quá 500 ký tự.' }],
        });
      }
    }

    // Kiểm tra avatarUrl nếu được gửi
    if (dto.avatarUrl !== undefined && dto.avatarUrl !== null && dto.avatarUrl !== '') {
      if (typeof dto.avatarUrl !== 'string') {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: 'Đường dẫn ảnh đại diện không hợp lệ.',
          details: [{ field: 'avatarUrl', message: 'Đường dẫn ảnh đại diện phải là chuỗi ký tự.' }],
        });
      }
      const trimmed = dto.avatarUrl.trim();
      if (trimmed !== '') {
        if (trimmed.length > 2048 || !trimmed.startsWith('https://')) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            code: 'VALIDATION_ERROR',
            message: 'Đường dẫn ảnh đại diện phải bắt đầu bằng https:// và không vượt quá 2048 ký tự.',
            details: [{ field: 'avatarUrl', message: 'URL ảnh đại diện phải bắt đầu bằng https:// và <= 2048 ký tự.' }],
          });
        }
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const data: {
      displayName?: string;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName.trim();
    }
    if (dto.bio !== undefined) {
      data.bio = dto.bio === '' ? null : dto.bio;
    }
    if (dto.avatarUrl !== undefined) {
      const trimmed = dto.avatarUrl ? dto.avatarUrl.trim() : '';
      data.avatarUrl = trimmed === '' ? null : trimmed;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return {
      id: updated.id.toString(),
      username: updated.username,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      rating: updated.rating,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
