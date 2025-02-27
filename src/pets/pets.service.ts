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
import { PaginationInput } from 'src/common/dto/pagination.dto';
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

  async find(userId: number, pagination: PaginationInput) {
    const { page, pageSize } = pagination;

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
    updatePetInput: UpdatePetInput,
    file: Express.Multer.File,
  ) {
    const { id: userId } = jwtUser;
    const { id: petId } = params;

    const pet = await this.petsRepository.findOne({
      where: { id: +petId, owner: { id: userId } },
    });

    if (!pet) {
      throw new NotFoundException('No pet found');
    }

    let photoUrl = pet.photo;
    // case 1: 현재 사진이 없는 상태, 새로운 사진 파일
    if (!pet.photo && file) {
      photoUrl = await this.uploadsService.uploadFile(file);
    } else if (pet.photo && file) {
      // case 2: 현재 사진 있는 상태, 새로운 사진 파일
      await this.uploadsService.deleteFile({ url: pet.photo });
      photoUrl = await this.uploadsService.uploadFile(file);
    } else if (pet.photo && !file) {
      // case 3: 사진 있는 상태에서 사진 지우기
      await this.uploadsService.deleteFile({ url: pet.photo });
      photoUrl = null;
    }

    const updateData = {
      ...pet,
      ...updatePetInput,
      photo: photoUrl,
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
