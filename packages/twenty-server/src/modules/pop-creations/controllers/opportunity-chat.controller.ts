/**
 * OpportunityChatController
 *
 * Provides a simple REST endpoint for the per-opportunity chat window.
 * The frontend sends a question and receives an AI-generated answer
 * grounded in the opportunity's email history and current summary.
 *
 * Auth: requires `Authorization: Bearer <POP_API_SECRET>` where
 *       POP_API_SECRET is an environment variable set at deployment time.
 *       The same secret is embedded in the frontend at build time via
 *       VITE_POP_API_SECRET.
 */

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { OpportunitySummaryService } from 'src/modules/pop-creations/services/opportunity-summary.service';

type ChatRequestBody = {
  question: string;
  workspaceId: string;
};

type ChatResponseBody = {
  answer: string;
};

@Controller('pop-creations/opportunity')
export class OpportunityChatController {
  private readonly logger = new Logger(OpportunityChatController.name);

  constructor(
    private readonly opportunitySummaryService: OpportunitySummaryService,
  ) {}

  @Post(':id/chat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async chat(
    @Param('id') opportunityId: string,
    @Body() body: ChatRequestBody,
    @Headers('authorization') authHeader: string,
  ): Promise<ChatResponseBody> {
    const expectedSecret = process.env.POP_API_SECRET ?? '';
    const providedSecret = (authHeader ?? '').replace(/^Bearer\s+/i, '');

    if (!expectedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid API secret');
    }

    if (!body.question?.trim()) {
      return { answer: '' };
    }

    this.logger.debug(
      `Chat request for opportunity ${opportunityId}: "${body.question.slice(0, 80)}"`,
    );

    const answer = await this.opportunitySummaryService.chat(
      body.workspaceId,
      opportunityId,
      body.question.trim(),
    );

    return { answer };
  }
}
