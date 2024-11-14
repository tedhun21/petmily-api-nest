import { IsArray, IsString } from 'class-validator';
import { CoreEntity } from 'src/common/entity/core.entity';
import { Reservation } from 'src/reservations/entity/reservation.entity';
import { Column, Entity, OneToOne } from 'typeorm';

@Entity()
export class Journal extends CoreEntity {
  @Column()
  @IsString()
  body: string;

  @Column('text', { array: true, nullable: true })
  @IsArray()
  @IsString({ each: true })
  photos: string[];

  @OneToOne(() => Reservation, (reservation) => reservation.journal, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  reservation: Reservation;
}
