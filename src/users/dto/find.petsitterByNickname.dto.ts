import { IsString } from 'class-validator';

export class FindUserByEmailOrNicknameDto {
  @IsString()
  q: string;
}
