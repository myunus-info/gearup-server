import { IsEnum } from 'class-validator';
import { RentalStatus } from '../../../common/enums/rental-status.enum.js';

export class UpdateOrderStatusDto {
  @IsEnum(RentalStatus, {
    message: 'Status must be CONFIRMED, PICKED_UP, RETURNED, or CANCELLED',
  })
  status: RentalStatus;
}
