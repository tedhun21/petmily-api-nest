import { PickType } from '@nestjs/mapped-types';
import { Pet } from '../entity/pet.entity';

export class CreatePetInput extends PickType(Pet, [
  'name',
  'species',
  'breed',
  'age',
  'weight',
  'body',
]) {}
