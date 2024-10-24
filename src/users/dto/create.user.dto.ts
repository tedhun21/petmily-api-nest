import { PickType } from '@nestjs/mapped-types';
import { User } from '../entity/user.entity';

export class CreateUserInput extends PickType(User, [
  'username',
  'nickname',
  'email',
  'password',
  'phone',
  'address',
  'detailAddress',
  'verified',
  'role',
  'provider',
]) {}

export class CreateUserOutput {}
