import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { FirefliesIngestController } from './controllers/fireflies-ingest.controller';
import { FirefliesApiClient } from './services/fireflies-api.client';
import { FirefliesIngestService } from './services/fireflies-ingest.service';

@Module({
  imports: [ConfigModule],
  controllers: [FirefliesIngestController],
  providers: [FirefliesApiClient, FirefliesIngestService],
  exports: [FirefliesIngestService],
})
export class FirefliesIngestModule {}
