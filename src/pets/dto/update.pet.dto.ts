import { PartialType } from '@nestjs/mapped-types';
import { CreatePetInput } from './create.pet.dto';

export class UpdatePetInput extends PartialType(CreatePetInput) {}

export class UpdatePetOutput {}
