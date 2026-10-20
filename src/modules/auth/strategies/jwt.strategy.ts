import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { User } from '../entities/user.entity.js';
import { UserStatus } from '../../../common/enums/user-status.enum.js';

export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.accessToken || null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        configService.get<string>('JWT_ACCESS_SECRET') ||
        'gearUpDefaultSecretKey12345',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.id },
      relations: { providerProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account has been suspended!');
    }

    return user;
  }
}
