import { PartialType } from '@nestjs/mapped-types';
import { Journal } from '../entity/journal.entity';

export class UpdateJournalInput extends PartialType(Journal) {
  deleteFiles: string[];
}
