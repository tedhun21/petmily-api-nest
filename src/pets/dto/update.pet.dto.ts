import { PartialType } from '@nestjs/mapped-types';
import { CreatePetDto } from './create.pet.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePetDto extends PartialType(CreatePetDto) {
  @IsOptional()
  @IsString()
  deletePhoto?: string;
}
