import { IsEnum } from 'class-validator';
import { UserStatus } from '../../../common/enums/user-status.enum.js';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, { message: 'Status must be ACTIVE or SUSPENDED' })
  status: UserStatus;
}
