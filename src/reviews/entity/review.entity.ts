import { CoreEntity } from 'src/common/entity/core.entity';
import { Reservation } from 'src/reservations/entity/reservation.entity';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';

@Entity()
export class Review extends CoreEntity {
  @Column()
  star: number;

  @Column()
  body: string;

  @Column('text', { array: true, nullable: true })
  photos: string[];

  @OneToOne(() => Reservation, (reservation) => reservation.review, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  reservation: Reservation;
}
