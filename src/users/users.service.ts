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
import { CreateUserDto } from './dto/create.user.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { UpdateUserDto } from './dto/update.user.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { FindPossiblePetsittersDto } from './dto/find.petsitterPossible.dto';
import { ReservationsService } from 'src/reservations/reservations.service';
import { ParamDto } from 'src/common/dto/param.dto';
import { ReservationStatus } from 'src/reservations/entity/reservation.entity';
import { UploadsService } from 'src/uploads/uploads.service';
import { UpdateFavoriteDto } from './dto/updateFavorite.user';
import { isValidLocation } from 'src/common/location/location.utils';
import { FindUserByEmailOrNicknameDto } from './dto/find.petsitterByNickname.dto';
import { RedisLocationService } from 'src/redis/location/redis-location.service';
import { RedisService } from 'src/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { instanceToPlain } from 'class-transformer';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly reservationsService: ReservationsService,
    private readonly uploadsService: UploadsService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly redisLocationService: RedisLocationService,
    private readonly configService: ConfigService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { email, nickname, password } = createUserDto;

    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { nickname }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException({
          statusCode: 409,
          field: 'email',
          message: 'This email is already registered',
          error: 'email_conflict',
        });
      }
      if (existingUser.nickname === nickname) {
        throw new ConflictException({
          statusCode: 409,
          field: 'nickname',
          message: 'This nickname is already registered',
          error: 'nickname_conflict',
        });
      }
    }

    const user = this.usersRepository.create(createUserDto);

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

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

  async findByEmailOrNickname(
    findUserByEmailOrNicknameDto: FindUserByEmailOrNicknameDto,
  ) {
    const { q } = findUserByEmailOrNicknameDto;

    const user = await this.usersRepository.findOne({
      where: q.includes('@') ? { email: q } : { nickname: q },
    });

    if (!user) {
      throw new NotFoundException('No user found');
    }

    return instanceToPlain(user, {
      groups: [user.role.toLowerCase(), 'common'],
    });
  }

  async me(jwtUser: JwtUser) {
    const { id: userId } = jwtUser;

    const me = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!me) {
      throw new NotFoundException('No user found');
    }

    return instanceToPlain(me, {
      groups: [me.role.toLowerCase(), 'common'],
    });
  }

  async update(
    params: ParamDto,
    jwtUser: JwtUser,
    updateUserDto: UpdateUserDto,
    file: Express.Multer.File,
  ) {
    const { id } = params;
    const { id: userId, role: currentRole } = jwtUser;
    const { password, role, deletePhoto, ...updataData } = updateUserDto;

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
      newJwt = await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_TOKEN'),
      });
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
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

  async delete(params: ParamDto, jwtUser: JwtUser) {
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
      relations: ['favorites'],
      select: { favorites: { id: true } },
    });

    if (!user || user.favorites.length === 0) {
      return {
        results: [],
        pagination: {
          total: 0,
          totalPages: 0,
          page: page,
          pageSize: pageSize,
        },
      };
    }

    const favoriteIds = user.favorites.map((fav) => fav.id);

    // 2. 페이징을 사용해 클라이언트의 좋아요 목록에서 펫시터 가져오기
    const [petsitters, total] = await this.usersRepository.findAndCount({
      where: { id: In(favoriteIds) },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      results: petsitters,
      pagination: {
        total,
        totalPages,
        page: page,
        pageSize: pageSize,
      },
    };
  }

  async findPossiblePetsitters(
    findPossiblePetsittersDto: FindPossiblePetsittersDto,
  ) {
    const { location, date, startTime, endTime, page, pageSize } =
      findPossiblePetsittersDto;

    // 동적 조건
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.PETSITTER });

    if (location) {
      queryBuilder.andWhere(':location = ANY(user.possibleLocations)', {
        location,
      });

      // Redis 위치 검색 카운트 증가 (안전 처리)
      if (isValidLocation(location)) {
        try {
          if (this.redisService.getClient().status === 'ready') {
            this.redisLocationService.incrementLocationCount(location);
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
      .take(pageSize)
      .skip((page - 1) * pageSize)
      .getManyAndCount();

    const totalPages = Math.ceil(total / pageSize);

    const results = petsitters.map((petsitter) =>
      instanceToPlain(petsitter, { groups: ['common', 'petsitter'] }),
    );

    return {
      results,
      pagination: { total, totalPages, page: page, pageSize: pageSize },
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
      .skip((page - 1) * pageSize)
      .take(pageSize)
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

    const totalPages = Math.ceil(total / pageSize);

    return {
      results: petsitters,
      pagination: { total, totalPages, page: page, pageSize: pageSize },
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

  async updateFavorite(jwtUser: JwtUser, updateFavoriteDto: UpdateFavoriteDto) {
    const { id: userId } = jwtUser;
    const { opponentId, action } = updateFavoriteDto;

    const [me, opponentExists] = await Promise.all([
      this.usersRepository.findOne({
        where: { id: userId },
        relations: ['favorites'],
        select: {
          id: true,
          favorites: { id: true },
        },
      }),
      this.usersRepository.count({ where: { id: opponentId } }),
    ]);

    if (opponentExists === 0) {
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
    const petsitter = await manager.findOne(User, {
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
    const petsitter = await manager.findOne(User, {
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

  async findUserById(id: number) {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'role'],
    });

    if (!user) {
      throw new NotFoundException('No user found with this ID');
    }

    return user;
  }

  async findUserByEmail(email: string) {
    const user = await this.usersRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('No user found with this Email');
    }

    return user;
  }

  async validateUserByEmailAndPassword(email: string, password: string) {
    const user = await this.findUserByEmail(email);

    if (!user || !user.password) {
      throw new NotFoundException('No user found');
    }

    const ok = await bcrypt.compare(password, user.password);

    if (ok) {
      return user;
    }

    return null;
  }
}
