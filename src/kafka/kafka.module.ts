import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaService } from './kafka.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          // 클라이언트와 브로커 연결 설정
          client: {
            clientId: 'notification',
            brokers: ['localhost:9092'],
            // retry: {
            //   retries: 5, // 브로커 연결 재시도 횟수
            //   initialRetryTime: 300, // 첫 번째 재시도 대기 시간
            //   maxRetryTime: 1000, // 재시도 간격의 최대 시간
            // },
          },
          consumer: { groupId: 'notification-consumer' },
        },
      },
    ]),
  ],
  providers: [KafkaService],
  exports: [ClientsModule, KafkaService],
})
export class KafkaModule {}
