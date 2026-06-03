import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { Response } from 'express';

@Catch()
export class PopCreationsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PopCreationsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    const status =
      exception instanceof Error && 'status' in exception
        ? (exception as { status: number }).status
        : HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error(
      `Exception caught: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      success: false,
      error: message,
    });
  }
}
