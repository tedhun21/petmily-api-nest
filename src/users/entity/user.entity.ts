import { CoreEntity } from 'src/common/entity/core.entity';
import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { Pet, PetSpecies } from 'src/pets/entity/pet.entity';
import { ChatMember } from 'src/chats/entity/chatMember.entity';
import { Notification } from 'src/notifications/entity/notification.entity';
import { NotificationRead } from 'src/notifications/entity/notification_read.entity';
import { Exclude, Expose } from 'class-transformer';

export enum UserRole {
  COMMON = 'common',
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
@Exclude() // 모든 필드 노출 X
export class User extends CoreEntity {
  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @Column()
  username: string;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @Column({ nullable: true })
  nickname?: string;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @Column()
  email: string;

  @Column({ nullable: true })
  password?: string;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.COMMON })
  role: UserRole;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @Column({ default: false })
  verified: boolean;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @Column({ nullable: true })
  zipcode: string;

  @Expose({ groups: ['client'] })
  @Column({ nullable: true })
  address?: string;

  @Expose({ groups: ['client'] })
  @Column({ nullable: true })
  detailAddress?: string;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @Column({ nullable: true })
  phone?: string;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @Column({ nullable: true })
  photo?: string;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @Column({ nullable: true })
  body?: string;

  @Expose({ groups: ['petsitter'] })
  @Column({ default: 0, nullable: true })
  star?: number;

  @Expose({ groups: ['petsitter'] })
  @Column({ default: 0, nullable: true })
  reviewCount?: number;

  @Expose({ groups: ['petsitter'] })
  @Column({ default: 0, nullable: true })
  completedReservationsCount?: number;

  @Column({ type: 'enum', enum: Provider })
  provider?: Provider;

  @Expose({ groups: ['petsitter'] })
  @Column('enum', { array: true, enum: PetSpecies, nullable: true })
  possiblePetSpecies?: PetSpecies[];

  @Expose({ groups: ['petsitter'] })
  @Column('enum', { array: true, enum: DayOfWeek, nullable: true })
  possibleDays: DayOfWeek[];

  @Expose({ groups: ['petsitter'] })
  @Column('text', { array: true, nullable: true })
  possibleLocations: string[];

  @Expose({ groups: ['petsitter'] })
  @Column({ type: 'time', nullable: true })
  possibleStartTime: string;

  @Expose({ groups: ['petsitter'] })
  @Column({ type: 'time', nullable: true })
  possibleEndTime: string;

  @Expose({ groups: ['client'] })
  @OneToMany(() => Pet, (pet) => pet.owner)
  pets: Pet[];

  @ManyToMany(() => User)
  @JoinTable({
    name: 'favorites', // 관계 테이블 이름
    joinColumn: { name: 'clientId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'petsitterId', referencedColumnName: 'id' },
  })
  favorites: User[];

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @OneToMany(() => ChatMember, (chatMember) => chatMember.user)
  chatMembers: ChatMember[];

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @ManyToMany(() => Notification, (notification) => notification.receivers)
  receivedNotifications: Notification[];

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @OneToMany(
    () => NotificationRead,
    (notificationRead) => notificationRead.user,
  )
  notificationReads: NotificationRead[];
}
