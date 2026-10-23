import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '../../common/guards/throttler.guard.js';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { handleCookies } from '../../common/utils/auth.util.js';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from './entities/user.entity.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return {
      message: 'User registered successfully',
      data: user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Authenticate user and set httpOnly session cookies' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);

    // Set cookies conforming to Next.js ofetch credentials: "include"
    handleCookies({
      type: 'login',
      res,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    return {
      message: 'User logged in successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token from httpOnly cookie or body' })
  async refreshToken(@Req() req: Request, @Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken || dto?.refreshToken;
    const result = await this.authService.refreshToken(token);

    handleCookies({
      type: 'login',
      res,
      accessToken: result.accessToken,
    });

    return {
      message: 'Access token refreshed successfully',
      data: result,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out user and clear httpOnly session cookies' })
  async logout(@Res({ passthrough: true }) res: Response) {
    handleCookies({
      type: 'logout',
      res,
    });

    return {
      message: 'User logged out successfully',
      data: null,
    };
  }

  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getMe(@CurrentUser() user: User) {
    const profile = await this.authService.getMe(user.id);
    return {
      message: 'User profile retrieved successfully',
      data: profile,
    };
  }
}
