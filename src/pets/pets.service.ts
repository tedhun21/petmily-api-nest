import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { CreatePetInput } from './dto/create.pet.dto';
import { Repository } from 'typeorm';
import { Pet } from './entity/pet.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UploadsService } from 'src/uploads/uploads.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UpdatePetInput } from './dto/update.pet.dto';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,
    private readonly uploadsService: UploadsService,
  ) {}

  async create(
    jwtUser: JwtUser,
    createPetInput: CreatePetInput,
    file: Express.Multer.File,
  ) {
    const { id: userId } = jwtUser;

    let photoUrl = null;
    if (file) {
      photoUrl = await this.uploadsService.uploadFile(file);
    }

    // Pet 엔티티 생성
    const pet = this.petsRepository.create({
      ...createPetInput,
      owner: { id: userId },
      ...(photoUrl && { photo: photoUrl }),
    });

    try {
      const createdPet = await this.petsRepository.save(pet);

      return { id: createdPet.id, message: 'Successfully registered a pet' };
    } catch (error) {
      throw new InternalServerErrorException(
        'Fail to register pet. Please try again later',
      );
    }
  }

  async find(userId: number, paginationDto: PaginationDto) {
    const { page, pageSize } = paginationDto;

    try {
      const [pets, total] = await this.petsRepository.findAndCount({
        where: { owner: { id: userId } },
        take: +pageSize,
        skip: (+page - 1) * +pageSize,
      });

      const totalPages = Math.ceil(total / +pageSize);

      return {
        results: pets,
        pagination: {
          total,
          totalPages,
          page: +page,
          pageSize: +pageSize,
        },
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch pets');
    }
  }

  async findOne(params: { id: string }) {
    const { id } = params;

    try {
      const pet = await this.petsRepository.findOne({ where: { id: +id } }); // await 추가

      if (!pet) {
        throw new NotFoundException('No pet found');
      }
      return pet;
    } catch (e) {
      throw new InternalServerErrorException(
        'Failed to fetch pet. Please try again later',
      );
    }
  }

  async update(
    jwtUser: JwtUser,
    params: { id: string },
    updatePetInput: UpdatePetInput & { deletePhoto: string },
    file: Express.Multer.File,
  ) {
    const { id: userId } = jwtUser;
    const { id: petId } = params;
    const { deletePhoto } = updatePetInput;

    const pet = await this.petsRepository.findOne({
      where: { id: +petId, owner: { id: userId } },
    });

    if (!pet) {
      throw new NotFoundException('No pet found');
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
      if (pet.photo) {
        await this.uploadsService.deleteFile({ url: pet.photo });
      }
    }
    // 삭제할 사진만 있을 때 (deletePhoto만 있을 때)
    else if (deletePhoto) {
      await this.uploadsService.deleteFile({ url: pet.photo });

      photo = null;
    }

    const updateData = {
      ...pet,
      ...updatePetInput,
      // photo가 undefined가 아닐 때만 필드에 포함
      ...(photo !== undefined && { photo }),
    };

    try {
      const updatedPet = await this.petsRepository.save(updateData);

      return { id: updatedPet.id, message: 'Successfully updated the pet' };
    } catch (e) {
      throw new InternalServerErrorException('Failed to update the pet');
    }
  }

  async delete(jwtUser: JwtUser, params: { id: string }) {
    const { id: userId } = jwtUser;
    const { id: petId } = params;

    const pet = await this.petsRepository.findOne({
      where: { id: +petId, owner: { id: userId } },
      select: { owner: { id: true } },
      relations: ['owner'],
    });

    if (!pet) {
      throw new NotFoundException('No pet found');
    }

    if (pet.owner.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this pet',
      );
    }

    try {
      await this.petsRepository.remove(pet);

      return { id: +petId, message: 'Successfully delete the pet' };
    } catch (e) {
      throw new InternalServerErrorException('Fail to delete pet');
    }
  }
}
