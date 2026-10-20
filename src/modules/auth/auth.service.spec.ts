import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { Role } from '../../common/enums/role.enum.js';
import { UserStatus } from '../../common/enums/user-status.enum.js';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: any;
  let mockProfileRepo: any;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockUserRepo = {
      findOne: vi.fn(),
      create: vi.fn((data) => ({ ...data, id: 'user-uuid-1' })),
      save: vi.fn((data) => Promise.resolve({ ...data, id: 'user-uuid-1' })),
      createQueryBuilder: vi.fn(),
    };
    mockProfileRepo = {
      create: vi.fn((data) => ({ ...data, id: 'profile-uuid-1' })),
    };
    mockJwtService = {
      sign: vi.fn(() => 'mock-jwt-token'),
      verify: vi.fn(() => ({ id: 'user-uuid-1' })),
    };
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'BCRYPT_SALT_ROUNDS') return 4;
        if (key === 'JWT_SECRET') return 'secret';
        if (key === 'JWT_REFRESH_SECRET') return 'refreshSecret';
        return undefined;
      }),
    };

    service = new AuthService(
      mockUserRepo,
      mockProfileRepo,
      mockJwtService,
      mockConfigService,
    );
  });

  it('registers a customer successfully', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    const result = await service.register({
      name: 'John Customer',
      email: 'john@example.com',
      password: 'password123',
      role: Role.CUSTOMER,
    });

    expect(result).toHaveProperty('id', 'user-uuid-1');
    expect(result).toHaveProperty('name', 'John Customer');
    expect(result).not.toHaveProperty('password');
  });

  it('throws conflict if email already exists', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'existing-id' });

    await expect(
      service.register({
        name: 'John Customer',
        email: 'john@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow('Email already in use');
  });

  it('authenticates user and returns access and refresh tokens', async () => {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash('password123', 4);

    const qbMock = {
      addSelect: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({
        id: 'user-uuid-1',
        name: 'John Customer',
        email: 'john@example.com',
        password: hashedPassword,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
      }),
    };
    mockUserRepo.createQueryBuilder.mockReturnValue(qbMock);

    const result = await service.login({
      email: 'john@example.com',
      password: 'password123',
    });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user).not.toHaveProperty('password');
  });
});
