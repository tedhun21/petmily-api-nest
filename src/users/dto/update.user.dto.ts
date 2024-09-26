import { UserRole } from '../entity/user.entity';

export class UpdateUserInput {
  username: string;
  nickname: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  detailAddress: string;
  role: UserRole;
}

export class UpdateUserOutput {}
