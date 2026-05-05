import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError } from 'zod';

type SchemaWithParse = {
  parse: (value: unknown) => unknown;
};

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: SchemaWithParse) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.issues,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
