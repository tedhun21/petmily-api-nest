import { CoreEntity } from 'src/common/entity/core.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from './user.entity';
import { IsString } from 'class-validator';

@Entity()
export class Verification extends CoreEntity {
  @Column()
  @IsString()
  code: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @BeforeInsert()
  @BeforeUpdate()
  createCode(): void {
    this.code = this.generateVerficationCode();
  }

  generateVerficationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };
}
