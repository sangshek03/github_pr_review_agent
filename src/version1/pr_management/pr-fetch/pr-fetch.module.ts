import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrFetchController } from './pr-fetch.controller';
import { PrFetchService } from './pr-fetch.service';
import { PrDataService } from './pr-data.service';
import { LlmService } from '../llm/llm.service';

// Import all entities
import { Repository } from '../repositories/repositories.entity';
import { PrMetadata } from '../pr-metadata/pr-metadata.entity';
import { GithubUser } from '../github-users/github-users.entity';
import { GithubPrReview } from '../github-pr-reviews/github-pr-reviews.entity';
import { PrComment } from '../pr-comments/pr-comments.entity';
import { PRFile } from '../pr-files/pr-files.entity';
import { PRCommit } from '../pr-commits/pr-commits.entity';
import { PrLabel } from '../pr-labels/pr-labels.entity';

import { User } from '../../user_management/users/users.entity';
import { JwtModule } from '@nestjs/jwt';
import { PRReview } from '../pr-reviews/pr-reviews.entity';
import { PrSummary } from '../pr-summary/pr-summary.entity';
import { ChatSession } from 'src/version1/chat_management/chat-sessions/chat-sessions.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Repository,
      PrMetadata,
      GithubUser,
      GithubPrReview,
      PrComment,
      PRFile,
      PRCommit,
      PrLabel,
      PRReview,
      User,
      PrSummary,
      ChatSession,
      PrMetadata,
      User,
    ]),
  ],
  controllers: [PrFetchController],
  providers: [PrFetchService, PrDataService, LlmService],
  exports: [PrFetchService, PrDataService],
})
export class PrFetchModule {}
