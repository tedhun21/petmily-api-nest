import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ReservationStatus } from '../entity/reservation.entity';
import { IsDateString, IsEnum, IsOptional, ValidateIf } from 'class-validator';

export class FindReservationsDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @ValidateIf((o) => o.status !== 'all') // 조건이 참일 때만 아래의 유효성 검사들을 수행
  @IsEnum(ReservationStatus)
  status?: ReservationStatus | 'all';
}
