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
    private petsRepository: Repository<Pet>,
    private uploadsService: UploadsService,
  ) {}

  async create(
    jwtUser: JwtUser,
    createPetInput: CreatePetInput,
    file: Express.Multer.File,
  ) {
    const { id: userId } = jwtUser;

    let photoUrl = null;

    // TODO: 파일이 있으면 업로드 후 URL을 받음
    if (file) {
      photoUrl = await this.uploadsService.uploadFile(file);

      if (!photoUrl) {
        throw new InternalServerErrorException(
          'Fail to upload image. Please try again later.',
        );
      }
    }

    // Pet 엔티티 생성
    const pet = this.petsRepository.create({
      ...createPetInput,
      owner: { id: userId },
      ...(photoUrl && { photo: photoUrl }),
    });

    try {
      const createdPet = await this.petsRepository.save(pet);

      return { id: createdPet.id, message: 'Successfully registered a pet.' };
    } catch (error) {
      throw new InternalServerErrorException(
        'Fail to register pet. Please try again later.',
      );
    }
  }

  async getPets(pagination: PaginationInput) {
    const { page, pageSize } = pagination;

    try {
      const [pets, total] = await this.petsRepository.findAndCount({
        take: pageSize,
        skip: (page - 1) * pageSize,
      });

      if (pets.length === 0) {
        throw new NotFoundException('No pets found.');
      }

      const totalPage = Math.ceil(total / pageSize);

      return {
        results: pets,
        pagination: {
          total,
          totalPage,
          page: +page,
          pageSize: +pageSize,
        },
      };
    } catch (e) {
      console.error('Error fetching pets:', e);
      throw new InternalServerErrorException('Fail to fetch pets.');
    }
  }

  async getPet(params: { id: string }) {
    const { id } = params;

    try {
      const pet = await this.petsRepository.findOne({ where: { id: +id } }); // await 추가

      if (!pet) {
        throw new NotFoundException('No pet found.');
      }
      return pet;
    } catch (e) {
      throw new InternalServerErrorException(
        'Failed to fetch pet. Please try again later.',
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
      throw new NotFoundException('No pet found.');
    }

    let photoUrl = null;
    if (!pet.photo && file) {
      photoUrl = await this.uploadsService.uploadFile(file);
    } else if (pet.photo && file) {
      await this.uploadsService.deleteFile({ url: pet.photo });
      photoUrl = await this.uploadsService.uploadFile(file);
    } else if (pet.photo && !file) {
      await this.uploadsService.deleteFile({ url: pet.photo });
      photoUrl = null;
    }

    const updateData = {
      ...pet,
      ...updatePetInput,
      ...(photoUrl && { photo: photoUrl }),
    };

    try {
      await this.petsRepository.save(updateData);

      return { id: petId, message: 'Successfully updated the pet.' };
    } catch (e) {
      throw new InternalServerErrorException('Failed to update the pet.');
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
      throw new NotFoundException('No pet found.');
    }

    if (pet.owner.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this pet.',
      );
    }

    try {
      await this.petsRepository.remove(pet);

      return { id: +petId, message: 'Successfully delete the pet.' };
    } catch (e) {
      throw new InternalServerErrorException('Fail to delete pet.');
    }
  }
}
