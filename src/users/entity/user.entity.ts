import { InternalServerErrorException } from '@nestjs/common';
import { CoreEntity } from 'src/common/entity/core.entity';
import { BeforeInsert, BeforeUpdate, Column, Entity } from 'typeorm';
import * as bcrypt from 'bcrypt';

export enum UserRole {
  Client = 'Client',
  Petsitter = 'Petsitter',
}

@Entity()
export class User extends CoreEntity {
  @Column()
  username: string;

  @Column()
  password: string;

  @Column()
  nickname: string;

  @Column()
  email: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column()
  address: string;

  @Column()
  detailAddress: string;

  @Column()
  phone: string;

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
