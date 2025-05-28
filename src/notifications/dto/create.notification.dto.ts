import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { NotificationType } from '../entity/notification.entity';

export class CreateNotificationDto {
  @IsOptional()
  @IsNumber()
  senderId?: number; // 시스템 알림이면 null 가능

  @IsArray()
  @IsNumber({}, { each: true })
  receiverIds: number[];

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsNumber()
  referenceId: number; // 관련 리소스 ID (ex. 예약 ID, 메시지 ID 등)

  @IsOptional()
  @IsString()
  message?: string; // 커스텀 메시지가 필요한 경우 (희귀하게 직접 설정할 때만)

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>; // 프론트에서 알림 메시지 생성에 사용할 정보
}
