import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity.js';
import { ProviderProfile } from '../../entities/provider-profile.entity.js';
import { Role } from '../../common/enums/role.enum.js';
import { UserStatus } from '../../common/enums/user-status.enum.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ProviderProfile)
    private readonly providerProfileRepository: Repository<ProviderProfile>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    if (dto.phone) {
      const existingPhone = await this.userRepository.findOne({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already in use');
      }
    }

    const saltRounds = Number(this.configService.get<number>('BCRYPT_SALT_ROUNDS')) || 12;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role || Role.CUSTOMER,
      phone: dto.phone,
      address: dto.address,
      status: UserStatus.ACTIVE,
    });

    if (dto.role === Role.PROVIDER) {
      user.providerProfile = this.providerProfileRepository.create({
        shopName: dto.shopName || `${dto.name}'s Shop`,
      });
    }

    const savedUser = await this.userRepository.save(user);

    // Omit password from return
    const { password: _pw, ...userWithoutPassword } = savedUser;
    void _pw;
    return userWithoutPassword;
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: { providerProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials!');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials!');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended!');
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const accessTokenSecret =
      this.configService.get<string>('JWT_SECRET') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'gearUpDefaultSecretKey12345';
    const accessTokenExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '1d';

    const refreshTokenSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'gearUpDefaultRefreshSecretKey12345';
    const refreshTokenExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const accessToken = this.jwtService.sign(payload, {
      secret: accessTokenSecret,
      expiresIn: accessTokenExpiresIn as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshTokenSecret,
      expiresIn: refreshTokenExpiresIn as any,
    });

    const { password: _pw, ...safeUser } = user;
    void _pw;

    return {
      user: safeUser,
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshTokenString?: string) {
    if (!refreshTokenString) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const refreshTokenSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'gearUpDefaultRefreshSecretKey12345';

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshTokenString, {
        secret: refreshTokenSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.id },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended!');
    }

    const newPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const accessTokenSecret =
      this.configService.get<string>('JWT_SECRET') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'gearUpDefaultSecretKey12345';
    const accessTokenExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '1d';

    const accessToken = this.jwtService.sign(newPayload, {
      secret: accessTokenSecret,
      expiresIn: accessTokenExpiresIn as any,
    });

    return { accessToken };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { providerProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found!');
    }

    const { password: _pw, ...safeUser } = user;
    void _pw;
    return safeUser;
  }
}
