import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';

@Module({
  imports: [HttpModule],
  controllers: [MapsController],
  providers: [MapsService],
})
export class MapsModule {}
