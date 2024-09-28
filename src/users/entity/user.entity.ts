import { InternalServerErrorException } from '@nestjs/common';
import { CoreEntity } from 'src/common/entity/core.entity';
import { BeforeInsert, BeforeUpdate, Column, Entity, OneToMany } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  IsEmail,
  IsEnum,
  IsPhoneNumber,
  IsString,
  Length,
} from 'class-validator';
import { Pet } from 'src/pets/entity/pet.entity';
import { Reservation } from 'src/reservations/entity/reservation.entity';

export enum UserRole {
  Client = 'Client',
  Petsitter = 'Petsitter',
}

@Entity()
export class User extends CoreEntity {
  @Column()
  @IsString()
  @Length(2, 50)
  username: string;

  @Column()
  @IsString()
  @Length(6, 30)
  password: string;

  @Column()
  @IsString()
  nickname: string;

  @Column()
  @IsEmail()
  email: string;

  @Column({ type: 'enum', enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @Column()
  @IsString()
  @Length(1, 30)
  address: string;

  @Column()
  @IsString()
  @Length(1, 30)
  detailAddress: string;

  @Column()
  @IsPhoneNumber('KR')
  phone: string;

  @OneToMany(() => Pet, (pet) => pet.owner)
  pets: Pet[];

  // 클라이언트로서 예약한 경우
  @OneToMany(() => Reservation, (reservation) => reservation.client)
  clientReservations: Reservation[];

  // 펫시터로서 예약받은 경우
  @OneToMany(() => Reservation, (reservation) => reservation.petsitter)
  petsitterReservations: Reservation[];

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
