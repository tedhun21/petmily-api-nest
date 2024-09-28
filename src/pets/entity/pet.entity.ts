import { IsEnum, IsString, Length, Max, Min } from 'class-validator';
import { CoreEntity } from 'src/common/entity/core.entity';
import { Reservation } from 'src/reservations/entity/reservation.entity';
import { User } from 'src/users/entity/user.entity';
import { Column, Entity, ManyToMany, ManyToOne } from 'typeorm';

export enum PetSpecies {
  Dog = 'Dog',
  Cat = 'Cat',
}

@Entity()
export class Pet extends CoreEntity {
  @Column()
  @IsString()
  @Length(2, 50)
  name: string;

  @Column({ type: 'enum', enum: PetSpecies })
  @IsEnum(PetSpecies)
  species: PetSpecies;

  @Column()
  @IsString()
  breed: string;

  @Column()
  @Min(0)
  @Max(25)
  age: number;

  @Column()
  @Min(0.1)
  @Max(50)
  weight: number;

  @Column({ nullable: true })
  @IsString()
  body?: string;

  @Column({ nullable: true })
  @IsString()
  photo?: string;

  @ManyToOne(() => User, (user) => user.pets)
  owner: User;

  @ManyToMany(() => Reservation, (reservation) => reservation.pets)
  reservations: Reservation[];
}
