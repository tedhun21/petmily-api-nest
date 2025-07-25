import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // 전역 유효성 검사 파이프 설정
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // "1" -> 1 등 자동 타입 변환 // DTO의 타입에 맞게 쿼리/바디를 자동 변환해서 일일이 수동 파싱 안해도 된다
    }),
  );

  app.enableCors({
    origin: ['http://localhost:3000', 'https://petmily.vercel.app'], // 허용할 여러 도메인
    credentials: true, // 프론트에서 보내느 credentials 설정 확인
  });

  app.setGlobalPrefix('api');

  // Kafka 연결 설정
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'notification-consumer',
      },
    },
  });

  // 마이크로서비스 시작 시도
  try {
    await app.startAllMicroservices();
    Logger.log('📡 Kafka Microservice is running...', 'Kafka');
  } catch (e) {
    Logger.error('❌ Kafka connection failed:', e.message, 'Kafka');
    // 로그만 출력하고 종료시키지 않음
  }

  // HTTP API 서버는 항상 실행
  await app.listen(8080);
  Logger.log('🚀 HTTP API Server running on port 8080', 'Bootstrap');
}
bootstrap();
