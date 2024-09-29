import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  ArrayContains,
  ArrayOverlap,
  In,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Raw,
  Repository,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { CreateUserInput } from './dto/create.user.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { UpdateUserInput } from './dto/update.user.dto';
import { PaginationInput } from 'src/common/dto/pagination.dto';
import { FindPossiblePetsittersInput } from './dto/findPossible.petsitter.dto';
import { ReservationsService } from 'src/reservations/reservations.service';
import { FindReservationsInput } from 'src/reservations/dto/find.reservation.dto';
import { ParamInput } from 'src/common/dto/param.dto';
import { Status } from 'src/reservations/entity/reservation.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly reservationsService: ReservationsService,
  ) {}

  async create(createUserInput: CreateUserInput) {
    const { email } = createUserInput;

    const exists = await this.usersRepository.findOne({ where: { email } });

    if (exists) {
      throw new ConflictException('This email is already registered');
    }
    const user = this.usersRepository.create(createUserInput);

    try {
      const newUser = await this.usersRepository.save(user);

      return {
        id: newUser.id,
        message: 'Successfully create a user',
      };
    } catch (e) {
      throw new InternalServerErrorException(
        'Failed to create a user. Please try again later',
      );
    }
  }

  async findById(params: ParamInput) {
    const { id } = params;

    const user = await this.usersRepository.findOne({ where: { id: +id } });

    if (!user) {
      throw new NotFoundException('No user found');
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('No user found');
    }
    return user;
  }

  async me(jwtUser: JwtUser) {
    const { id: userId } = jwtUser;
    const me = await this.usersRepository.findOne({ where: { id: userId } });

    if (!me) {
      throw new NotFoundException('No user found');
    }

    return me;
  }

  async update(params, jwtUser: JwtUser, updateUserInput: UpdateUserInput) {
    const { id } = params;
    const { id: userId } = jwtUser;
    const { password, ...updateData } = updateUserInput;

    if (+id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this user',
      );
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('No user found');
    }

    if (password) {
      user.password = password;
    }

    const updateUserData = {
      ...user,
      ...updateData,
    };

    const updatedUser = await this.usersRepository.save(updateUserData);

    return { id: updatedUser.id, message: 'Successfully update the user' };
  }

  async delete(params: ParamInput, jwtUser: JwtUser) {
    const { id } = params;
    const { id: userId } = jwtUser;

    if (+id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this user',
      );
    }

    const user = await this.usersRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException('No user found');
    }

    try {
      await this.usersRepository.remove(user);

      return { id: +userId, message: 'Successfully delete the user' };
    } catch (e) {
      throw new InternalServerErrorException('Fail to delete the user');
    }
  }

  async findFavoritePetsitters(jwtUser: JwtUser, pagination: PaginationInput) {
    const { id: userId } = jwtUser;
    const { page, pageSize } = pagination;

    // 1. 클라이언트 유저를 찾음
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. 페이징을 사용해 클라이언트의 좋아요 목록에서 펫시터 가져오기
    const [favorites, total] = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.favorites', 'petsitter') // 유저의 좋아요한 펫시터 목록
      .where('user.id = :userId', { userId })
      .skip((+page - 1) * +pageSize) // 페이징: 스킵
      .take(+pageSize) // 페이징: 테이크
      .getManyAndCount(); // 총 갯수와 목록 반환

    const totalPages = Math.ceil(total / +pageSize);
    const favoritePetsitters = favorites.flatMap((user) => user.favorites);

    return {
      results: favoritePetsitters,
      pagination: {
        total,
        totalPages,
        page: +page,
        pageSize: +pageSize,
      },
    };
  }

  async findPossiblePetsitters(
    findPossiblePetsittersIput: FindPossiblePetsittersInput,
  ) {
    const { date, startTime, endTime, address, petType, page, pageSize } =
      findPossiblePetsittersIput;
    // 동적으로 where 조건을 생성
    const whereCondition: any = {
      role: 'Petsitter',
    };

    if (date) {
      const formattedDay = new Date(date).toLocaleDateString('en', {
        weekday: 'short',
      });
      // 포함하는거 일치하는거 하나
      whereCondition.possibleDays = ArrayContains([formattedDay]);
    }

    if (startTime) {
      whereCondition.possibleStartTime = LessThanOrEqual(startTime);
    }

    if (endTime) {
      whereCondition.possibleEndTime = MoreThanOrEqual(endTime);
    }

    if (address) {
      const formattedAddress = JSON.parse(address);
      // ArrayOverlap 여러개 중 하나라도 포함하는게 있으면
      whereCondition.possibleLocations = ArrayOverlap([...formattedAddress]);
    }

    if (typeof petType === 'string') {
      const formattedPetType = JSON.parse(petType);
      // ArrayOverlap 여러개 중 하나라도 포함하는게 있으면
      whereCondition.possiblePetTypes = ArrayOverlap([...formattedPetType]);
    }

    try {
      const [petsitters, total] = await this.usersRepository.findAndCount({
        where: whereCondition,
        select: {
          id: true,
          nickname: true,
          email: true,
          role: true,
          address: true,
          possibleDays: true,
          possibleLocations: true,
          possiblePetTypes: true,
          possibleStartTime: true,
          possibleEndTime: true,
        },
        take: +pageSize,
        skip: (+page - 1) * +pageSize,
      });

      const totalPage = Math.ceil(total / +pageSize);

      return {
        results: petsitters,
        pagination: { total, totalPage, page: +page, pageSize: +pageSize },
      };
    } catch (e) {}
  }

  async findUsedPetsitters(jwtUser: JwtUser, pagination: PaginationInput) {
    try {
      // 내가 가지고 있는 예약
      const reservations = await this.reservationsService.find(jwtUser, {
        status: Status.Completed,
        ...pagination,
      });

      return {
        results: reservations.results.map(
          (reservation) => reservation.petsitter,
        ),
        pagination: reservations.pagination,
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch used petsitters');
    }
  }
}
