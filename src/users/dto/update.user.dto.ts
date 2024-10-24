import { PartialType } from '@nestjs/mapped-types';
import { User } from '../entity/user.entity';

export class UpdateUserInput extends PartialType(User) {}

export class UpdateUserOutput {}
