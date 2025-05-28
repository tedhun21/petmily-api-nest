import {
  IsArray,
  IsDateString,
  IsNumber,
  IsString,
  Matches,
} from 'class-validator';

export class CreateReservationDto {
  @IsDateString()
  date: string;

  @Matches(/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @Matches(/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @IsString()
  address: string;

  @IsString()
  detailAddress: string;

  @IsString()
  zipcode: string;

  @IsNumber()
  petsitterId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  petIds: number[];

  @IsString()
  body: string;
}
