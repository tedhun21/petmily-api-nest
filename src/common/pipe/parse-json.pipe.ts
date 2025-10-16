import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ParseJsonPipe implements PipeTransform {
  transform(value: string, metadata: ArgumentMetadata) {
    const { metatype } = metadata;

    if (!metatype) {
      return value;
    }

    let parsedValue;
    try {
      parsedValue = JSON.parse(value);
    } catch (error) {
      throw new BadRequestException('Validation failed: Invalid JSON string');
    }

    return plainToInstance(metatype, parsedValue);
  }
}
