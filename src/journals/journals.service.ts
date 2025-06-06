import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Journal } from './entity/journal.entity';
import { CreateJournalDto } from './dto/create.journal.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { ReservationsService } from 'src/reservations/reservations.service';
import { UploadsService } from 'src/uploads/uploads.service';
import { UpdateJournalDto } from './dto/update.journal.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UserRole } from 'src/users/entity/user.entity';
import { ParamDto } from 'src/common/dto/param.dto';

@Injectable()
export class JournalsService {
  constructor(
    @InjectRepository(Journal)
    private readonly journalsRepository: Repository<Journal>,
    private readonly reservationsService: ReservationsService,
    private readonly uploadsService: UploadsService,
  ) {}

  async create(
    jwtUser: JwtUser,
    createJournalDto: CreateJournalDto,
    files: Array<Express.Multer.File>,
  ) {
    const { id: userId, role } = jwtUser;

    const { reservationId } = createJournalDto;

    const reservation = await this.reservationsService.findOne(jwtUser, {
      id: reservationId,
    });

    if (role !== UserRole.PETSITTER || reservation.petsitter.id !== userId) {
      throw new ForbiddenException(
        "You don't have permission to create a journal.",
      );
    }

    if (reservation.journal) {
      throw new ConflictException('Journal with reservation already exists');
    }

    let photoUrls = [];
    if (files && files.length > 0) {
      photoUrls = await Promise.all(
        files.map(async (file) => await this.uploadsService.uploadFile(file)),
      );
    }
    const journal = this.journalsRepository.create({
      ...createJournalDto,
      ...(photoUrls.length > 0 && { photos: photoUrls }),
      reservation: { id: reservationId },
    });

    try {
      const newJournal = await this.journalsRepository.save(journal);

      return { id: newJournal.id, message: 'Successfully create a journal' };
    } catch (e) {
      throw new InternalServerErrorException('Fail to create a journal');
    }
  }

  async find(jwtUser: JwtUser, paginationDto: PaginationDto) {
    const { id: userId, role } = jwtUser;
    const { page, pageSize } = paginationDto;

    const whereCondition =
      role === UserRole.CLIENT
        ? { reservation: { client: { id: userId } } }
        : role === UserRole.PETSITTER && {
            reservation: { petsitter: { id: userId } },
          };

    try {
      const [journals, total] = await this.journalsRepository.findAndCount({
        where: whereCondition,
        take: +pageSize,
        skip: (+page - 1) * +pageSize,
      });

      const totalPages = Math.ceil(total / +pageSize);

      return {
        results: journals,
        pagination: { total, totalPages, page: +page, pageSize: +pageSize },
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch the journals');
    }
  }

  async findOne(jwtUser: JwtUser, paramDto: ParamDto) {
    const { id: userId } = jwtUser;
    const { id: journalId } = paramDto;

    try {
      const journal = await this.journalsRepository.findOne({
        where: { id: +journalId },
        relations: ['reservation.client', 'reservation.petsitter'],
      });

      if (!journal) {
        throw new NotFoundException('Journal not found');
      }

      const { petsitter, client } = journal.reservation;
      if (petsitter.id !== userId && client.id !== userId) {
        throw new ForbiddenException(
          "You don't have permission to fetch the journal.",
        );
      }

      return journal;
    } catch (e) {
      throw new InternalServerErrorException('Fail to fetch the journal');
    }
  }

  async update(
    jwtUser: JwtUser,
    params: { id: string | number },
    updateJournalDto: UpdateJournalDto,
    files: Array<Express.Multer.File>,
  ) {
    const { id: userId } = jwtUser;
    const { id: journalId } = params;
    const { deletePhotos, body } = updateJournalDto;

    const journal = await this.journalsRepository.findOne({
      where: { id: +journalId },
      relations: ['reservation.petsitter'],
    });

    if (!journal) {
      throw new NotFoundException('No journal found');
    }

    if (journal.reservation.petsitter.id !== userId) {
      throw new ForbiddenException(
        "You don't permission to update the journal.",
      );
    }

    // journal.photos가 배열이 아니면 빈 배열로 초기화
    journal.photos = journal.photos || [];

    if (deletePhotos && deletePhotos.length > 0) {
      await Promise.all(
        deletePhotos.map(
          async (file) => await this.uploadsService.deleteFile({ url: file }),
        ),
      );
      journal.photos = journal.photos.filter(
        (url: string) => !deletePhotos.includes(url),
      );
    }

    // newPhotoUrls를 항상 배열로 초기화
    let newPhotoUrls: string[] = [];
    if (files && files.length > 0) {
      newPhotoUrls = await Promise.all(
        files.map(async (file) => await this.uploadsService.uploadFile(file)),
      );
    }

    journal.photos = [...journal.photos, ...newPhotoUrls];

    const updateJournalData = {
      ...journal,
      body,
    };

    try {
      const updatedJournal =
        await this.journalsRepository.save(updateJournalData);

      return {
        id: updatedJournal.id,
        message: 'Successfully update the journal',
      };
    } catch (e) {
      throw new InternalServerErrorException('Fail to update the journal');
    }
  }

  async delete(jwtUser: JwtUser, paramDto: ParamDto) {
    const { id: userId } = jwtUser;
    const { id: journalId } = paramDto;

    const journal = await this.journalsRepository.findOne({
      where: { id: +journalId },
      relations: ['reservation.client', 'reservation.petsitter'],
    });

    if (!journal) {
      throw new NotFoundException('No journal found');
    }

    const { petsitter, client } = journal.reservation;
    if (petsitter.id !== userId && client.id !== userId) {
      throw new ForbiddenException(
        "You don't have permission delete the journal.",
      );
    }

    if (journal.photos && journal.photos.length > 0) {
      await Promise.all(
        journal.photos.map(
          async (url) => await this.uploadsService.deleteFile({ url }),
        ),
      );
    }

    try {
      await this.journalsRepository.remove(journal);

      return { id: +journalId, message: 'Successfully delete the journal' };
    } catch (e) {
      throw new InternalServerErrorException('Fail to delete the journal');
    }
  }
}
