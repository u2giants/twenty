import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { PopCreationsExceptionFilter } from 'src/modules/pop-creations/logic-functions/fireflies-ingest/filters/pop-creations-exception.filter';

import { FirefliesIngestService } from '../services/fireflies-ingest.service';
import type { FirefliesProcessResult } from '../types/fireflies-ingest.types';

@Controller('s/fireflies-webhook')
@UseGuards(PublicEndpointGuard, NoPermissionGuard)
@UseFilters(PopCreationsExceptionFilter)
export class FirefliesIngestController {
  private readonly logger = new Logger(FirefliesIngestController.name);

  constructor(
    private readonly firefliesIngestService: FirefliesIngestService,
  ) {}

  @Post()
  async handleWebhook(
    @Body() body: unknown,
    @Headers('x-hub-signature') signature: string | undefined,
    @Req()
    request: Request & {
      headers: Record<string, string | string[] | undefined>;
    },
  ): Promise<FirefliesProcessResult> {
    this.logger.log('Received Fireflies webhook');

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      headers[key] = Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
    }

    const result = await this.firefliesIngestService.processWebhook({
      payload: body,
      signature,
      headers,
    });

    this.logger.log(`Webhook processed: success=${result.success}`);

    return result;
  }
}
