import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private producer: ClientKafka | null = null;
  private consumer: ClientKafka | null = null;
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    try {
      this.producer = this.kafkaClient;
      this.consumer = this.kafkaClient;

      await this.producer.connect();
      await this.consumer.connect();

      this.logger.log('✅ Kafka connected');
    } catch (error) {
      this.logger.error('⚠️ Error initializing Kafka', error);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.kafkaClient) {
        await this.kafkaClient.close();
        this.logger.log('🛑 Kafka connection closed');
      }
    } catch (error) {
      this.logger.error('⚠️ Error closing Kafka connection:', error);
    }
  }

  getProducer(): ClientKafka | null {
    if (!this.producer) {
      this.logger.warn('⚠️ Kafka producer is not available');
    }
    return this.producer;
  }

  getConsumer(): ClientKafka | null {
    if (!this.consumer) {
      this.logger.warn('⚠️ Kafka consumer is not available');
    }
    return this.consumer;
  }
}
