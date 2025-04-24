// import { Repository } from 'typeorm';
// import { Reservation, ReservationStatus } from './entity/reservation.entity';
// import { Injectable } from '@nestjs/common';
// import { PaginationInput } from 'src/common/dto/pagination.dto';

// @Injectable()
// export class ReservationRepository extends Repository<Reservation> {
//   async findCompletedReservationsByUser(
//     userId: number,
//     pagination: PaginationInput,
//   ): Promise<[Reservation[], number]> {
//     const page = Number(pagination.page); // Current page number
//     const pageSize = Number(pagination.pageSize); // Number of items per page

//     const [reservations, total] = await this.findAndCount({
//       where: {
//         client: { id: userId },
//         status: ReservationStatus.COMPLETED,
//       },
//       relations: ['petsitter'],
//       skip: (page - 1) * pageSize, // Number of records to skip
//       take: pageSize, // Number of records to take
//     });

//     return [reservations, total];
//   }
// }
