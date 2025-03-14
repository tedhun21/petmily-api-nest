import { IsArray, IsInt, IsString, Max, Min } from 'class-validator';
import { CoreEntity } from 'src/common/entity/core.entity';
import { Reservation } from 'src/reservations/entity/reservation.entity';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';

@Entity()
export class Review extends CoreEntity {
  @Column()
  @IsInt()
  @Min(1)
  @Max(5)
  star: number;

  @Column()
  @IsString()
  body: string;

  @Column('text', { array: true, nullable: true })
  @IsArray()
  @IsString({ each: true })
  photos: string[];

  @OneToOne(() => Reservation, (reservation) => reservation.review, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  reservation: Reservation;
}
