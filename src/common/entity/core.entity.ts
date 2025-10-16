import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Expose } from 'class-transformer';

@Entity()
export class CoreEntity {
  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @PrimaryGeneratedColumn()
  id: number;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Expose({ groups: ['common', 'client', 'petsitter'] })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
