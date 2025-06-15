import { CoreEntity } from 'src/common/entity/core.entity';
import { Journal } from 'src/journals/entity/journal.entity';
import { Pet } from 'src/pets/entity/pet.entity';
import { Review } from 'src/reviews/entity/review.entity';
import { User } from 'src/users/entity/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
} from 'typeorm';

export enum ReservationStatus {
  PENDING = 'pending',
  CANCELED = 'canceled',
  ACCEPTED = 'accepted',
  COMPLETED = 'completed',
}

@Entity()
export class Reservation extends CoreEntity {
  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ nullable: true })
  zipcode: string;

  @Column()
  address: string;

  @Column()
  detailAddress: string;

  @Column({ type: 'enum', enum: ReservationStatus })
  status: ReservationStatus;

  @Column({ nullable: true })
  body: string;

  @ManyToOne(() => User)
  client: User;

  @ManyToOne(() => User)
  petsitter: User;

  @ManyToMany(() => Pet, (pet) => pet.reservations)
  @JoinTable()
  pets: Pet[];

  @OneToOne(() => Journal, (journal) => journal.reservation, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  journal: Journal;

  @OneToOne(() => Review, (review) => review.reservation, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  review: Review;
}
