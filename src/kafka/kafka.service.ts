import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private producer: ClientKafka | null = null;
  private consumer: ClientKafka | null = null;

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}
  async onModuleInit() {
    try {
      this.producer = this.kafkaClient;
      this.consumer = this.kafkaClient;

      await this.producer.connect();
      await this.consumer.connect();

      console.log('✅ Kafka connected');
    } catch (error) {
      console.error('⚠️ Error initializing Kafka:', error);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.kafkaClient) {
        await this.kafkaClient.close();
        console.log('🛑 Kafka connection closed');
      }
    } catch (error) {
      console.error('⚠️ Error closing Kafka connection:', error);
    }
  }

  getProducer(): ClientKafka | null {
    if (!this.producer) {
      console.warn('⚠️ Kafka producer is not available');
    }
    return this.producer;
  }

  getConsumer(): ClientKafka | null {
    if (!this.consumer) {
      console.warn('⚠️ Kafka consumer is not available');
    }
    return this.consumer;
  }
}
