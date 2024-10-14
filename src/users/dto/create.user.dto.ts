import { PickType } from '@nestjs/mapped-types';
import { User, UserRole } from '../entity/user.entity';

export class CreateUserInput extends PickType(User, [
  'username',
  'nickname',
  'email',
  'password',
  'phone',
  'address',
  'detailAddress',
  'role',
  'provider',
]) {}

export class CreateUserOutput {}
