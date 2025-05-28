import { PartialType } from '@nestjs/mapped-types';
import { CreateJournalDto } from './create.journal.dto';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateJournalDto extends PartialType(CreateJournalDto) {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deletePhotos?: string[];
}
