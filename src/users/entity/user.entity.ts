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
import { Pet, PetSpecies } from 'src/pets/entity/pet.entity';
import { ChatMember } from 'src/chats/entity/chatMember.entity';
import { Notification } from 'src/notifications/entity/notification.entity';
import { NotificationRead } from 'src/notifications/entity/notification_read.entity';

export enum UserRole {
  USER = 'user',
  CLIENT = 'client',
  PETSITTER = 'petsitter',
}
export enum Provider {
  LOCAL = 'local',
  KAKAO = 'kakao',
  GOOGLE = 'google',
  NAVER = 'naver',
}
export enum DayOfWeek {
  MON = 'mon',
  TUE = 'tue',
  WED = 'wed',
  THU = 'thu',
  FRI = 'fri',
  SAT = 'sat',
  SUN = 'sun',
}

@Entity()
export class User extends CoreEntity {
  @Column()
  username: string;

  @Column({ nullable: true })
  nickname?: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  password?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ default: false })
  verified: boolean;

  @Column({ nullable: true })
  zipcode: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  detailAddress?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  photo?: string;

  @Column({ nullable: true })
  body?: string;

  @Column({ default: 0, nullable: true })
  star?: number;

  @Column({ default: 0, nullable: true })
  reviewCount?: number;

  @Column({ default: 0, nullable: true })
  completedReservationsCount?: number;

  @Column({ type: 'enum', enum: Provider })
  provider?: Provider;

  @Column('enum', { array: true, enum: PetSpecies, nullable: true })
  possiblePetSpecies?: PetSpecies[];

  @Column('enum', { array: true, enum: DayOfWeek, nullable: true })
  possibleDays: DayOfWeek[];

  @Column('text', { array: true, nullable: true })
  possibleLocations: string[];

  @Column({ type: 'time', nullable: true })
  possibleStartTime: string;

  @Column({ type: 'time', nullable: true })
  possibleEndTime: string;

  // 가지고 있는 펫 (for client)
  @OneToMany(() => Pet, (pet) => pet.owner)
  pets: Pet[];

  @ManyToMany(() => User)
  @JoinTable({
    name: 'favorites', // 관계 테이블 이름
    joinColumn: { name: 'clientId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'petsitterId', referencedColumnName: 'id' },
  })
  favorites: User[];

  @OneToMany(() => ChatMember, (chatMember) => chatMember.user)
  chatMembers: ChatMember[];

  @ManyToMany(() => Notification, (notification) => notification.receivers)
  receivedNotifications: Notification[];

  @OneToMany(
    () => NotificationRead,
    (notificationRead) => notificationRead.user,
  )
  notificationReads: NotificationRead[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    // 만약 엔티티가 업데이트 되면서 훅이 작동하여 비밀번호를 다시 해시화하게 되면 비밀번호가 이중으로 해시화된다
    if (
      this.password &&
      !this.password.startsWith('$2b$') // password값이 실제로 변경될 때만 해시화가 실행되도록 // bcrypt는 보통 해시된 값이 "$2b$"로 시작하므로
    ) {
      try {
        this.password = await bcrypt.hash(this.password, 10);
      } catch (e) {
        console.error('Error hashing password:', e);
        throw new InternalServerErrorException('Error hashing password');
      }
    }
  }

  async checkPassword(aPassword: string): Promise<boolean> {
    try {
      if (!aPassword || !this.password) {
        console.error('Missing password or hash');
        throw new InternalServerErrorException('Missing password or hash');
      }

      const isMatch = await bcrypt.compare(aPassword, this.password);
      return isMatch;
    } catch (e) {
      console.error('Error comparing password:', e);
      throw new InternalServerErrorException('Password comparison error');
    }
  }
}
