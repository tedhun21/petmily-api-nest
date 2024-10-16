import { InternalServerErrorException } from '@nestjs/common';
import { CoreEntity } from 'src/common/entity/core.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsPhoneNumber,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Pet, Species } from 'src/pets/entity/pet.entity';
import { Reservation } from 'src/reservations/entity/reservation.entity';

export enum UserRole {
  USER = 'User',
  CLIENT = 'Client',
  PETSITTER = 'Petsitter',
}

export enum PetsitterApprovalStatus {
  PENDING = 'Pending', // 승인 대기 중
  APPROVED = 'Approved', // 승인 완료
  REJECTED = 'Rejected', // 승인 거절
}

export enum DayOfWeek {
  MON = 'Mon',
  TUE = 'Tue',
  WED = 'Wed',
  THU = 'Thu',
  FRI = 'Fri',
  SAT = 'Sat',
  SUN = 'Sun',
}

@Entity()
export class User extends CoreEntity {
  @Column()
  @IsString()
  @Length(2, 50)
  username: string;

  @Column({ nullable: true })
  @IsString()
  @Length(6, 30)
  password?: string;

  @Column({ nullable: true })
  @IsString()
  nickname?: string;

  @Column()
  @IsEmail()
  email: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  @IsEnum(UserRole)
  role: UserRole;

  @Column({ nullable: true })
  @IsString()
  @Length(1, 30)
  address?: string;

  @Column({ nullable: true })
  @IsString()
  @Length(1, 30)
  detailAddress?: string;

  @Column({ nullable: true })
  @IsPhoneNumber('KR')
  phone?: string;

  @Column({ nullable: true })
  @IsString()
  photo?: string;

  @Column({ nullable: true })
  @IsString()
  body?: string;

  @Column({ default: 0, nullable: true })
  @IsNumber()
  @Min(0)
  @Max(5)
  star?: number;

  @Column({ default: 0, nullable: true })
  @IsNumber()
  @Min(0)
  reviewCount?: number;

  @Column({ default: 0, nullable: true })
  @IsNumber()
  @Min(0)
  completedReservationsCount?: number;

  @Column({ default: 'local' })
  @IsString()
  provider?: string;

  @Column('enum', { array: true, enum: Species, nullable: true })
  @IsArray()
  @IsEnum(Species)
  possiblePetSpecies: Species[];

  @Column('enum', { array: true, enum: DayOfWeek, nullable: true })
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  possibleDays: DayOfWeek[];

  @Column('text', { array: true, nullable: true })
  @IsArray()
  @IsString({ each: true })
  possibleLocations: string[];

  @Column({ type: 'time', nullable: true })
  @IsString()
  possibleStartTime: string;

  @Column({ type: 'time', nullable: true })
  @IsString()
  possibleEndTime: string;

  // 가지고 있는 펫 (for client)
  @OneToMany(() => Pet, (pet) => pet.owner)
  pets: Pet[];

  // 클라이언트로서 예약한 경우 (for client)
  @OneToMany(() => Reservation, (reservation) => reservation.client)
  clientReservations: Reservation[];

  // 펫시터로서 예약받은 경우 (for petsitter)
  @OneToMany(() => Reservation, (reservation) => reservation.petsitter)
  petsitterReservations: Reservation[];

  // 좋아요 표시  for client
  @ManyToMany(() => User)
  @JoinTable({
    name: 'favorites', // 관계 테이블 이름
    joinColumn: { name: 'clientId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'petsitterId', referencedColumnName: 'id' },
  })
  favorites: User[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password) {
      try {
        this.password = await bcrypt.hash(this.password, 10);
      } catch (e) {
        throw new InternalServerErrorException();
      }
    }
  }

  async checkPassword(aPassword: string): Promise<boolean> {
    try {
      const ok = await bcrypt.compare(aPassword, this.password);

      return ok;
    } catch (e) {
      throw new InternalServerErrorException();
    }
  }
}
