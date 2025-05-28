import { CoreEntity } from 'src/common/entity/core.entity';
import { Reservation } from 'src/reservations/entity/reservation.entity';
import { User } from 'src/users/entity/user.entity';
import { Column, Entity, ManyToMany, ManyToOne } from 'typeorm';

export enum PetGender {
  MALE = 'male',
  FEMALE = 'female',
}

export enum PetSpecies {
  DOG = 'dog',
  CAT = 'cat',
}

@Entity()
export class Pet extends CoreEntity {
  @Column()
  name: string;

  @Column({ type: 'enum', enum: PetGender })
  gender: PetGender;

  @Column({ type: 'enum', enum: PetSpecies })
  species: PetSpecies;

  @Column()
  breed: string;

  @Column()
  age: number;

  @Column()
  weight: number;

  @Column()
  neutering: boolean;

  @Column({ nullable: true })
  body?: string;

  @Column({ nullable: true })
  photo?: string;

  @ManyToOne(() => User, (user) => user.pets)
  owner: User;

  @ManyToMany(() => Reservation, (reservation) => reservation.pets)
  reservations?: Reservation[];
}
