import { PickType } from '@nestjs/mapped-types';
import { Journal } from '../entity/journal.entity';

export class CreateJournalInput extends PickType(Journal, ['body']) {
  reservationId: number;
}
