import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PetGender, PetSpecies } from '../entity/pet.entity';

export class CreatePetDto {
  @IsString()
  name: string;

  @IsEnum(PetSpecies)
  species: PetSpecies;

  @IsEnum(PetGender)
  gender: PetGender;

  @IsString()
  breed: string;

  @IsNumber()
  age: number;

  @IsNumber()
  weight: number;

  @IsBoolean()
  neutering: boolean;

  @IsOptional()
  @IsString()
  body?: string;
}
