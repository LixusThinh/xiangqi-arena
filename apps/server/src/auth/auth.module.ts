import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthJwtGuard } from './auth-jwt.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_TTL_SEC } from './auth.constants';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret) {
          throw new Error('JWT_ACCESS_SECRET must be set in apps/server/.env');
        }
        // expiresIn phải khớp với `expiresIn` trả về trong AuthSessionResponse
        return { secret, signOptions: { expiresIn: ACCESS_TOKEN_TTL_SEC } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthJwtGuard],
  exports: [AuthJwtGuard, JwtModule],
})
export class AuthModule {}
