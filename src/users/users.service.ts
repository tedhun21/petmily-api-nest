import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { Brackets, EntityManager, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole } from './entity/user.entity';
import { CreateUserInput } from './dto/create.user.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { UpdateUserInput } from './dto/update.user.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { FindPossiblePetsittersInput } from './dto/findPossible.petsitter.dto';
import { ReservationsService } from 'src/reservations/reservations.service';
import { ParamInput } from 'src/common/dto/param.dto';
import { ReservationStatus } from 'src/reservations/entity/reservation.entity';
import { UploadsService } from 'src/uploads/uploads.service';
import { JwtService } from '@nestjs/jwt';
import { UpdateFavoriteInput } from './dto/updateFavorite.user';
import { RedisService } from 'src/redis/redis.service';
import { isValidLocation } from 'src/common/location/location.utils';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly reservationsService: ReservationsService,
    private readonly uploadsService: UploadsService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async create(createUserInput: CreateUserInput) {
    const { email, nickname } = createUserInput;

    const existingEmail = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingEmail) {
      throw new ConflictException({
        statusCode: 409,
        field: 'email',
        message: 'This email is already registered',
        error: 'email_conflict', // 타입 추가
      });
    }

    const existingNickname = await this.usersRepository.findOne({
      where: { nickname },
    });

    if (existingNickname) {
      throw new ConflictException({
        statusCode: 409,
        field: 'nickname',
        message: 'This nickname is already registered',
        error: 'nickname_conflict', // 타입 추가
      });
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

  async findByIds(ids: number[]) {
    const users = await this.usersRepository.find({
      where: { id: In(ids) },
      select: ['id', 'nickname', 'photo', 'role'],
    });

    return users;
  }

  async findByEmailOrNickname(EmailOrNickname: string) {
    // 모든 필드를 가져오되, 역할에 따라 나중에 필드를 필터링
    const user = await this.usersRepository.findOne({
      where: EmailOrNickname.includes('@')
        ? { email: EmailOrNickname }
        : { nickname: EmailOrNickname },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        photo: true,
        pets: true, // 클라이언트만 사용하는 필드들
        star: true, // 펫시터만 사용하는 필드들
        reviewCount: true,
        possibleDays: true,
        possibleLocations: true,
        possiblePetSpecies: true,
        possibleStartTime: true,
        possibleEndTime: true,
        favorites: true,
        // 기타 공통 필드들
      },
    });

    // 역할에 따라 필터링
    if (user.role === UserRole.CLIENT) {
      // 클라이언트일 경우 펫시터 전용 필드를 제거
      delete user.star;
      delete user.reviewCount;
      delete user.possibleDays;
      delete user.possibleLocations;
      delete user.possiblePetSpecies;
      delete user.possibleStartTime;
      delete user.possibleEndTime;
    } else if (user.role === UserRole.PETSITTER) {
      // 펫시터일 경우 펫시터 전용 필드를 제거
      delete user.pets;
    }

    return user;
  }

  async me(jwtUser: JwtUser) {
    const { id: userId, role } = jwtUser;

    let conditionalSelect: any = {
      id: true,
      username: true,
      nickname: true,
      email: true,
      verified: true,
      role: true,
      address: true,
      detailAddress: true,
      photo: true,
      provider: true,
      pets: true,
    };

    if (role === UserRole.PETSITTER) {
      conditionalSelect = {
        ...conditionalSelect,
        possibleDays: true,
        possiblePetSpecies: true,
        possibleStartTime: true,
        possibleEndTime: true,
        possibleLocations: true,
      };

      delete conditionalSelect.pets;
    }

    const me = await this.usersRepository.findOne({
      where: { id: userId },
      select: conditionalSelect,
    });

    if (!me) {
      throw new NotFoundException('No user found');
    }

    return me;
  }

  async update(
    params: ParamInput,
    jwtUser: JwtUser,
    updateUserInput: UpdateUserInput & { deletePhoto?: string },
    file: Express.Multer.File,
  ) {
    const { id } = params;
    const { id: userId, role: currentRole } = jwtUser;
    const { password, role, deletePhoto, ...updataData } = updateUserInput;

    if (userId !== +id) {
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

    // 사진 로직
    let photo: string | null | undefined;
    // undefined -> "아무것도 안 들어옴" (기존 URL 유지)
    // null -> "삭제만 요청" (DB에 null 저장)
    // string -> "새 URL" (새 이미지 URL 저장)

    // file만 있을 때
    if (file) {
      photo = await this.uploadsService.uploadFile(file);

      // 기존의 사진이 있다면 삭제
      if (user.photo) {
        await this.uploadsService.deleteFile({ url: user.photo });
      }
    }
    // 삭제할 사진만 있을 때 (deletePhoto만 있을 때)
    else if (deletePhoto) {
      await this.uploadsService.deleteFile({ url: deletePhoto });

      photo = null;
    }
    // 3. 아무것도 안 들어올 경우
    // => 기존의 photoUrl을 그대로 사용

    // role을 업데이트 했을때 jwt업데이트
    let newJwt = null;
    if (role && role !== currentRole) {
      const payload = { id: user.id, role };
      newJwt = await this.jwtService.signAsync(payload);
    }

    if (password) {
      user.password = password;
    }

    const updateUserData = {
      ...user,
      ...updataData,
      role,
      // photo가 undefined가 아닐 때만 필드에 포함
      ...(photo !== undefined && { photo }),
    };

    const updatedUser = await this.usersRepository.save(updateUserData);

    return {
      id: updatedUser.id,
      message: 'Successfully update the user',
      ...(newJwt && { newToken: newJwt }),
    };
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

  async findFavoritePetsitters(jwtUser: JwtUser, paginationDto: PaginationDto) {
    const { id: userId } = jwtUser;
    const { page, pageSize } = paginationDto;

    // 1. 클라이언트 유저를 찾음
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      // 2. 페이징을 사용해 클라이언트의 좋아요 목록에서 펫시터 가져오기
      const [favorites, total] = await this.usersRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.favorites', 'petsitter') // Join the favorites relation
        .where('user.id = :userId', { userId })
        .skip((+page - 1) * +pageSize) // Apply pagination skip
        .take(+pageSize) // Apply pagination limit
        .getManyAndCount(); // Return the list of petsitters and the total count

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
    } catch (e) {
      throw new InternalServerErrorException(
        'Fail to fetch favorite petsitters',
      );
    }
  }

  async findPossiblePetsitters(
    findPossiblePetsittersIput: FindPossiblePetsittersInput,
  ) {
    const { location, date, startTime, endTime, page, pageSize } =
      findPossiblePetsittersIput;

    // 동적 조건
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .where('user.role = :role', { role: 'Petsitter' });

    if (location) {
      // 요소 부분 일치
      queryBuilder.andWhere(
        "ARRAY_TO_STRING(user.possibleLocations, ',') ILIKE :location",
        { location: `%${location}%` },
      );

      // Redis 위치 검색 카운트 증가 (안전 처리)
      if (isValidLocation(location)) {
        try {
          if (this.redisService.getClient().status === 'ready') {
            this.redisService.incrementLocationCount(location);
          }
        } catch (error) {
          console.error('❌ Redis 위치 카운트 증가 실패:', error);
        }
      }
    }

    if (date) {
      const formattedDay = new Date(date).toLocaleDateString('en', {
        weekday: 'short',
      });

      queryBuilder.andWhere(':formattedDay = ANY(user.possibleDays)', {
        formattedDay,
      });
    }

    if (startTime) {
      queryBuilder.andWhere('user.possibleStartTime <= :startTime', {
        startTime,
      });
    }

    if (endTime) {
      queryBuilder.andWhere('user.possibleEndTime >= :endTime', { endTime });
    }

    const [petsitters, total] = await queryBuilder
      .select([
        'user.id',
        'user.nickname',
        'user.photo',
        'user.role',
        'user.address',
        'user.body',
        'user.possibleDays',
        'user.possibleLocations',
        'user.possiblePetSpecies',
        'user.possibleStartTime',
        'user.possibleEndTime',
        'user.reviewCount',
        'user.star',
      ])
      .take(+pageSize)
      .skip((+page - 1) & +pageSize)
      .getManyAndCount();

    const totalPages = Math.ceil(total / +pageSize);

    return {
      results: petsitters,
      pagination: { total, totalPages, page: +page, pageSize: +pageSize },
    };
  }

  async findUsedPetsitters(jwtUser: JwtUser, paginationDto: PaginationDto) {
    try {
      // 내가 가지고 있는 예약
      const reservations = await this.reservationsService.find(jwtUser, {
        status: ReservationStatus.COMPLETED,
        ...paginationDto,
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

  // 위치 기반 펫시터 검색
  async findPetsittersByLocation(words: string, paginationDto: PaginationDto) {
    const { page, pageSize } = paginationDto;

    const wordsArray = words.split(' ').map((word) => `%${word}%`); // 검색어를 LIKE 패턴으로 변환

    const query = this.usersRepository
      .createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.PETSITTER })
      .andWhere(
        new Brackets((qb) => {
          wordsArray.forEach((word) => {
            qb.orWhere('user.possibleLocations ILIKE :word', { word });
          });
        }),
      )
      .skip((+page - 1) * +pageSize)
      .take(+pageSize)
      .select([
        'user.id',
        'user.nickname',
        'user.role',
        'user.photo',
        'user.star',
        'user.reviewCount',
        'user.possibleDays',
        'user.possibleLocations',
        'user.possiblePetSpecies',
        'user.possibleStartTime',
        'user.possibleEndTime',
      ]);

    const [petsitters, total] = await query.getManyAndCount();

    const totalPages = Math.ceil(total / +pageSize);

    return {
      results: petsitters,
      pagination: { total, totalPages, page: +page, pageSize: +pageSize },
    };
  }

  async findStarPetsitters() {}

  async getFavorites(jwtUser: JwtUser) {
    const { id: userId } = jwtUser;

    const me = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['favorites'],
      select: { favorites: { id: true, nickname: true, photo: true } },
    });

    return me.favorites;
  }

  async updateFavorite(
    jwtUser: JwtUser,
    updateFavoriteInput: UpdateFavoriteInput,
  ) {
    const { id: userId } = jwtUser;
    const { opponentId, action } = updateFavoriteInput;

    // 현재 사용자 가져오기 (favorites)
    const me = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['favorites'],
      select: {
        id: true,
        favorites: { id: true },
      },
    });

    // 상대방 유저 존재 여부 확인 (count() 사용)
    const userExists = await this.usersRepository.count({
      where: { id: opponentId },
    });
    if (userExists === 0) {
      throw new NotFoundException('User not found');
    }

    // favorites 배열에서 opponentId를 포함하는지 체크
    const isFavorite = me.favorites.some((fav) => fav.id === opponentId);

    if (action === 'favorite' && !isFavorite) {
      me.favorites.push({ id: opponentId } as User); // 객체 참조 없이 ID만 추가
    } else if (action === 'unfavorite' && isFavorite) {
      me.favorites = me.favorites.filter((fav) => fav.id !== opponentId);
    }

    await this.usersRepository.save(me);

    return { message: 'Successfully update favorite', favorite: action };
  }

  // 리뷰 생성과 Transaction
  async updatePetsitterStar(
    petsitterId: number,
    star: number,
    manager: EntityManager,
    isNewReview: boolean,
  ) {
    const petsitter = await this.usersRepository.findOne({
      where: { id: petsitterId },
    });

    if (!petsitter) {
      throw new InternalServerErrorException('Petsitter not found');
    }

    const reviewCount = petsitter.reviewCount || 0;
    const currentAverage = petsitter.star || 0;

    let newAverage: number;

    if (isNewReview) {
      // 새 리뷰일 때만 reviewCount를 증가시키고 평균을 계산
      newAverage = (currentAverage * reviewCount + star) / (reviewCount + 1);
      petsitter.reviewCount = reviewCount + 1; // 리뷰 카운트를 증가
    } else {
      // 리뷰 업데이트일 때는 새로운 별점을 반영하여 평균을 다시 계산
      newAverage =
        (currentAverage * reviewCount - petsitter.star + star) / reviewCount;
    }

    petsitter.star = newAverage;

    try {
      const updatedPetsitter = await manager.save(petsitter);

      return {
        id: updatedPetsitter.id,
        message: 'Successfully update the petsitter',
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to update star');
    }
  }

  async updatePetsitterCompleted(petsitterId: number, manager: EntityManager) {
    const petsitter = await this.usersRepository.findOne({
      where: { id: petsitterId },
    });

    if (!petsitter) {
      throw new NotFoundException('No petsitter found');
    }

    petsitter.completedReservationsCount =
      (petsitter.completedReservationsCount || 0) + 1;

    try {
      await manager.save(petsitter);
    } catch (e) {
      throw new InternalServerErrorException(
        'Fail to update petsitter completed',
      );
    }
  }

  async validateUserById(id: number) {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'role'],
    });

    if (!user) {
      throw new NotFoundException('No user found with this ID');
    }

    return user;
  }

  async findByEmailWithPassword(email: string) {
    const user = await this.usersRepository.findOne({
      where: { email },
      select: ['id', 'email', 'role', 'password'],
    });

    return user;
  }
}
