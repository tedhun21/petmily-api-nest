import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsString } from 'class-validator';
import { CoreEntity } from 'src/common/entity/core.entity';
import { Pet } from 'src/pets/entity/pet.entity';
import { User } from 'src/users/entity/user.entity';
import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';

export enum Status {
  Pending = 'Pending',
  Canceled = 'Canceled',
  Accepted = 'Accepted',
  Completed = 'Completed',
}

@Entity()
export class Reservation extends CoreEntity {
  @Column({ type: 'date' })
  @IsDate()
  @Type(() => Date)
  date: string;

  @Column({ type: 'time' })
  @IsString()
  startTime: string;

  @Column({ type: 'time' })
  @IsString()
  endTime: string;

  @Column()
  @IsString()
  address: string;

  @Column({ type: 'enum', enum: Status })
  @IsEnum(Status)
  status: Status;

  // 클라이언트 (예약을 생성한 사용자)
  @ManyToOne(() => User, (user) => user.clientReservations)
  client: User;

  // 펫시터 (예약을 수락하는 사용자)
  @ManyToOne(() => User, (user) => user.petsitterReservations)
  petsitter: User;

  @ManyToMany(() => Pet, (pet) => pet.reservations, { eager: true })
  @JoinTable()
  pets: Pet[];
}
