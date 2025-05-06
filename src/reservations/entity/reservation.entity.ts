import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsString } from 'class-validator';
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
  PENDING = 'Pending',
  CANCELED = 'Canceled',
  ACCEPTED = 'Accepted',
  COMPLETED = 'Completed',
}

@Entity()
export class Reservation extends CoreEntity {
  @Column({ type: 'date' })
  @IsDate()
  @Type(() => Date)
  date: Date;

  @Column({ type: 'time' })
  @IsString()
  startTime: string;

  @Column({ type: 'time' })
  @IsString()
  endTime: string;

  @Column({ nullable: true })
  @IsString()
  zipcode: string;

  @Column()
  @IsString()
  address: string;

  @Column()
  @IsString()
  detailAddress: string;

  @Column({ type: 'enum', enum: ReservationStatus })
  @IsEnum(ReservationStatus)
  status: ReservationStatus;

  @Column({ nullable: true })
  @IsString()
  body: string;

  // 클라이언트 (예약을 생성한 사용자)
  @ManyToOne(() => User, (user) => user.clientReservations)
  client: User;

  // 펫시터 (예약을 수락하는 사용자)
  @ManyToOne(() => User, (user) => user.petsitterReservations)
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
