import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
} from 'class-validator';
import { Provider, UserRole } from '../entity/user.entity';

export class CreateUserDto {
  @IsString()
  @Length(2, 50)
  username: string;

  @IsString()
  nickname: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Length(6, 30)
  password?: string;

  @IsBoolean()
  verified: boolean;

  @IsOptional()
  @IsPhoneNumber('KR')
  phone?: string;

  @IsString()
  zipcode?: string;

  @IsString()
  @Length(1, 30)
  address?: string;

  @IsString()
  @Length(1, 30)
  detailAddress?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsEnum(Provider)
  provider: Provider;
}
