import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  Any,
  ArrayContains,
  ArrayOverlap,
  Brackets,
  EntityManager,
  ILike,
  In,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  Raw,
  Repository,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole } from './entity/user.entity';
import { CreateUserInput } from './dto/create.user.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { UpdateUserInput } from './dto/update.user.dto';
import { PaginationInput } from 'src/common/dto/pagination.dto';
import { FindPossiblePetsittersInput } from './dto/findPossible.petsitter.dto';
import { ReservationsService } from 'src/reservations/reservations.service';
import { ParamInput } from 'src/common/dto/param.dto';
import { Status } from 'src/reservations/entity/reservation.entity';
import { UploadsService } from 'src/uploads/uploads.service';
import { JwtService } from '@nestjs/jwt';
import { SearchType } from 'src/search/dto/save-recent.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly reservationsService: ReservationsService,
    private readonly uploadsService: UploadsService,
    private readonly jwtService: JwtService,
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

  async findById(params: ParamInput) {
    const { id } = params;

    const user = await this.usersRepository.findOne({
      where: { id: +id },
      select: ['id', 'nickname', 'body', 'photo', 'role'],
    });

    if (!user) {
      throw new NotFoundException('No user found');
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    return user || null; // 유저가 없으면 null 반환
  }

  async me(jwtUser: JwtUser) {
    const { id: userId, role } = jwtUser;

    let conditionalSelect: (keyof User)[] = [
      'id',
      'username',
      'email',
      'nickname',
      'role',
      'verified',
      'address',
      'detailAddress',
      'phone',
      'photo',
      'body',
    ];

    if (role === 'Petsitter') {
      conditionalSelect.push(
        'possibleDays',
        'possiblePetSpecies',
        'possibleStartTime',
        'possibleEndTime',
        'possibleLocations',
      );
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
    updateUserInput: UpdateUserInput,
    file: Express.Multer.File,
  ) {
    const { id } = params;
    const { id: userId, role: currentRole } = jwtUser;
    const { password, role, ...updataData } = updateUserInput;

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

    // 업데이트할 파일이 있다면
    let photoUrl = null;
    if (file) {
      photoUrl = await this.uploadsService.uploadFile(file);
    }

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
      ...(photoUrl && { photo: photoUrl }),
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
    const { date, startTime, endTime, address, petSpecies, page, pageSize } =
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
      // ArrayOverlap 여러개 중 하나라도 포함하는게 있으면
      whereCondition.possibleLocations = ArrayContains([address]);
    }

    if (typeof petSpecies === 'string') {
      const formattedPetSpecies = JSON.parse(petSpecies);
      // ArrayOverlap 여러개 중 하나라도 포함하는게 있으면
      whereCondition.possiblePetSpecies = ArrayOverlap([
        ...formattedPetSpecies,
      ]);
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
          possiblePetSpecies: true,
          possibleStartTime: true,
          possibleEndTime: true,
          reviewCount: true,
          star: true,
          body: true,
        },
        take: +pageSize,
        skip: (+page - 1) * +pageSize,
      });

      const totalPages = Math.ceil(total / +pageSize);

      return {
        results: petsitters,
        pagination: { total, totalPages, page: +page, pageSize: +pageSize },
      };
    } catch (e) {
      throw new InternalServerErrorException(
        'Fail to fetch possible petsitters',
      );
    }
  }

  async findUsedPetsitters(jwtUser: JwtUser, pagination: PaginationInput) {
    try {
      // 내가 가지고 있는 예약
      const reservations = await this.reservationsService.find(jwtUser, {
        status: Status.COMPLETED,
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

  // 펫시터 닉네임 포함하는 검색
  // star, reviewCount 높은 순
  async findPetsittersByNickname(query: string, pagination: PaginationInput) {
    const { page, pageSize } = pagination;

    // 펫시터 닉네임
    const [petsitters, total] = await this.usersRepository.findAndCount({
      order: { star: 'DESC', reviewCount: 'DESC' },
      where: { role: UserRole.PETSITTER, nickname: ILike(`%${query}%`) }, // ILIKE로 부분 일치를 구현
      select: ['id', 'nickname', 'role', 'photo'],
      skip: (+page - 1) * +pageSize,
      take: +pageSize,
    });

    const totalPages = Math.ceil(total / +pageSize);

    return {
      results: petsitters,
      pagination: {
        total,
        totalPages,
        page: +page,
        pageSize: +pageSize,
      },
    };
  }

  // 위지 기반 펫시터 검색
  async findPetsittersByLocation(words: string, pagination: PaginationInput) {
    const { page, pageSize } = pagination;

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

  async updateRecentSearches(
    userId: number,
    searchTerm: { id: number },
    type: SearchType,
    action: 'add' | 'remove',
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!User) {
      throw new NotFoundException('No user found');
    }
    try {
      let updatedSearches = user.recentSearches || [];

      if (type === SearchType.USER) {
        if (action === 'add') {
          console.log('add');
          // 기존에 같은 검색어가 없으면 추가
          if (
            !updatedSearches.some(
              (search) =>
                search.id === searchTerm.id && search.type === SearchType.USER,
            )
          ) {
            updatedSearches.push({
              id: searchTerm.id,
              type: SearchType.USER,
              timestamp: Date.now(),
            });
          }

          // 검색어가 5개 이상이면 가장 오래된 검색어 삭제
          if (updatedSearches.length > 5) {
            updatedSearches.sort((a, b) => b.timestamp - a.timestamp); // 최신 순으로 정렬
            updatedSearches = updatedSearches.slice(0, 5); // 최신 5개만 남기기
          }
        } else if (action === 'remove') {
          console.log('remove');
          // 검색어가 있으면 제거
          updatedSearches = updatedSearches.filter(
            (search) =>
              !(search.id === searchTerm.id && search.type === SearchType.USER),
          );
        }
      }

      // 업데이트된 검색어 배열 저장
      user.recentSearches = updatedSearches;
      await this.usersRepository.save(user);
      return {
        message: 'Successfully update recent searches',
        recentSearches: updatedSearches,
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to save recent searches');
    }
  }

  async findRecentSearches(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['recentSearches'],
    });

    const results = await Promise.all(
      user.recentSearches.map(async (search) => {
        if (search.type === SearchType.USER) {
          const result = await this.usersRepository.findOne({
            where: { id: userId },
            select: ['id', 'nickname', 'photo'],
          });

          return { ...result, type: search.type };
        }
      }),
    );

    return results;
  }
}
