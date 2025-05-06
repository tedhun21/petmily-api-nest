import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 유효성 검사 파이프 설정
  app.useGlobalPipes(new ValidationPipe());

  app.enableCors({
    origin: ['http://localhost:3000', 'https://petmily.vercel.app'], // 허용할 여러 도메인
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
    console.log('📡 Kafka Microservice is running...');
  } catch (e) {
    console.error('❌ Kafka connection failed:', e.message);
    // 로그만 출력하고 종료시키지 않음
  }

  // HTTP API 서버는 항상 실행
  await app.listen(8080);
  console.log('🚀 HTTP API Server running on port 8080');
}
bootstrap();
