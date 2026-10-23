import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum.js';
import { UserStatus } from '../enums/user-status.enum.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user || request.currentUser;

    if (user && user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended!');
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!user) {
      throw new ForbiddenException('User is not authenticated.');
    }

    const hasPermission = requiredRoles.includes(user.role);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Forbidden! You do not have permission to perform this action. Required role: [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
