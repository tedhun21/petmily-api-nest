import { Module } from '@nestjs/common';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';
import { Pet } from './entity/pet.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  imports: [TypeOrmModule.forFeature([Pet]), UploadsModule],
  controllers: [PetsController],
  providers: [PetsService],
})
export class PetsModule {}
