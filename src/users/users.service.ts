import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { CreateUserInput } from './dto/create.user.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { UpdateUserInput } from './dto/update.user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserInput: CreateUserInput) {
    const { email } = createUserInput;

    const exists = await this.usersRepository.findOne({ where: { email } });

    if (exists) {
      throw new ConflictException('This email is already registered.');
    }
    const user = this.usersRepository.create(createUserInput);

    try {
      const newUser = await this.usersRepository.save(user);

      return {
        id: newUser.id,
        message: 'Successfully create a user.',
      };
    } catch (e) {
      throw new InternalServerErrorException(
        'Failed to create a user. Please try again later.',
      );
    }
  }

  async findById(params: { id: string }) {
    const { id } = params;

    const user = await this.usersRepository.findOne({ where: { id: +id } });

    if (!user) {
      throw new NotFoundException('No user found.');
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('No user found.');
    }
    return user;
  }

  async me(jwtUser: JwtUser) {
    const { id, email } = jwtUser;
    const me = await this.usersRepository.findOne({ where: { id, email } });

    if (!me) {
      throw new NotFoundException('No user found.');
    }

    return me;
  }

  async update(params, jwtUser: JwtUser, updateUserInput: UpdateUserInput) {
    const { id } = params;
    const { id: userId, email } = jwtUser;
    const { password, ...updateData } = updateUserInput;

    if (+id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this user.',
      );
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('No user found.');
    }

    if (password) {
      user.password = password;
    }

    const updateUserData = {
      ...user,
      ...updateData,
    };

    const updatedUser = await this.usersRepository.save(updateUserData);

    return { id: updatedUser.id, message: 'Successfully update the user.' };
  }

  async delete(params: { id: string }, jwtUser: JwtUser) {
    const { id } = params;
    const { id: userId } = jwtUser;

    if (+id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this user.',
      );
    }

    const user = await this.usersRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException('No user found.');
    }

    try {
      await this.usersRepository.remove(user);

      return { id: +userId, message: 'Successfully delete the user.' };
    } catch (e) {
      throw new InternalServerErrorException('Fail to delete the user.');
    }
  }
}
