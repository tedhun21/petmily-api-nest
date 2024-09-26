import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
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
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserInput: CreateUserInput) {
    const {
      email,
      password,
      username,
      nickname,
      role,
      address,
      detailAddress,
      phone,
    } = createUserInput;
    try {
      const exists = await this.usersRepository.findOne({ where: { email } });

      if (exists) {
        throw new ConflictException('This email is already registered.');
      }

      const newUser = await this.usersRepository.save(
        this.usersRepository.create({
          email,
          password,
          username,
          nickname,
          role,
          address,
          detailAddress,
          phone,
        }),
      );

      return {
        id: newUser.id,
        message: 'Successfully create a user.',
      };
    } catch (e) {
      throw new BadRequestException('Fail to create a user.');
    }
  }

  async findById(params: { id: string }) {
    const { id } = params;

    const user = await this.usersRepository.findOne({ where: { id: +id } });

    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException();
    }
    return user;
  }

  async me(jwtUser: JwtUser) {
    const { id, email } = jwtUser;
    const me = await this.usersRepository.findOne({ where: { id, email } });

    if (!me) {
      throw new NotFoundException();
    }

    return me;
  }

  async update(params, jwtUser: JwtUser, updateUserInput: UpdateUserInput) {
    const { id } = params;
    const { id: userId, email } = jwtUser;
    const { password, ...updateData } = updateUserInput;

    if (+id !== userId) {
      throw new ForbiddenException();
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException();
    }

    if (password) {
      user.password = password;
    }

    const updateUserData = {
      ...user,
      ...updateData,
    };

    const updatedUser = await this.usersRepository.save(
      this.usersRepository.create(updateUserData),
    );

    return { id: updatedUser.id, message: 'Successfully update the user.' };
  }

  async delete(params: { id: string }, jwtUser: JwtUser) {
    const { id } = params;
    const { id: userId } = jwtUser;

    if (+id !== userId) {
      throw new ForbiddenException();
    }

    const user = await this.usersRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException();
    }

    const deletedUser = await this.usersRepository.remove(user);

    if (!deletedUser) {
      throw new BadRequestException('Fail to delete the user.');
    }

    return { id: user.id, message: 'Successfully delete the user.' };
  }
}
