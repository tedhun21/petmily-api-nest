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

  await app.listen(8080);
  console.log('🚀 HTTP API Server running on port 8080');

  const kafkaApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: ['localhost:9092'],
        },
        consumer: {
          groupId: 'notification-consumer',
        },
      },
    },
  );

  await kafkaApp.listen();
  console.log('📡 Kafka Microservice is running...');
}
bootstrap();
