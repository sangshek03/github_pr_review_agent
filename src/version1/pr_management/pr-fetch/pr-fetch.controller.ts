import {
  Controller,
  Post,
  Get,
  Body,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  UseInterceptors,
  UseGuards,
  ClassSerializerInterceptor,
  Param,
} from '@nestjs/common';
import { PrFetchService } from './pr-fetch.service';
import { AnalyzeDTO, FetchPRDto, PRDetailsResponse, FetchAndSaveResponse, UserPRsResponse } from './pr-fetch.dto';
import { PRReviewResponse } from '../llm/llm.service';
import { AuthCookieGuard } from './guards/auth-cookie.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { PrDataService } from './pr-data.service';

@Controller('pr')
@UseInterceptors(ClassSerializerInterceptor)
export class PrFetchController {
  constructor(private readonly prFetchService: PrFetchService,
    private readonly prDataService: PrDataService
  ) {}

  @Post('fetch-check')
  @HttpCode(HttpStatus.OK)
  async fetchPRDetails(
    @Body(ValidationPipe) fetchPRDto: FetchPRDto,
  ): Promise<PRDetailsResponse> {
    const prDetails = await this.prFetchService.fetchPRDetails(fetchPRDto.pr_url);

    return {
      success: true,
      message: 'PR details fetched successfully',
      data: prDetails,
    };
  }

  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthCookieGuard)
  async fetchAndSavePRDetails(
    @Body(ValidationPipe) fetchPRDto: FetchPRDto,
    @CurrentUser() user: { user_id: string },
  ): Promise<FetchAndSaveResponse> {
    const result = await this.prFetchService.fetchAndSavePRDetails(
      fetchPRDto.pr_url,
      user.user_id
    );

    return {
      success: true,
      message: 'PR details fetched and saved successfully',
      data: result,
    };
  }

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthCookieGuard)
  async analyzePR(
    @Body(ValidationPipe) analyzeDto: FetchPRDto,
    @CurrentUser() user: { user_id: string },
  ): Promise<{
    success: boolean;
    message: string;
    data: PRReviewResponse;
  }> {
    const analysis = await this.prFetchService.analyzePR(analyzeDto, user.user_id);

    return {
      success: true,
      message: 'PR analysis completed successfully',
      data: analysis,
    };
  }

  @Get('my-prs')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthCookieGuard)
  async getUserPRs(
    @CurrentUser() user: { user_id: string },
  ): Promise<UserPRsResponse> {
    const userPRs = await this.prDataService.getUserPRs(user.user_id);

    const formattedPRs: PRDetailsResponse[] = userPRs.map(pr => ({
      success: true,
      message: 'PR details retrieved successfully',
      data: {
        metadata: pr.metadata,
        reviews: pr.reviews,
        comments: pr.comments,
        files: pr.files,
      }
    }));

    return {
      success: true,
      message: `Retrieved ${userPRs.length} PRs successfully`,
      data: formattedPRs,
    };
  }

  @Get('pr_summaries')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthCookieGuard)
  async getAllPrSummaries(
    @CurrentUser() user: { user_id: string },
  ): Promise<{
    success: boolean;
    message: string;
    data: PRReviewResponse[];
  }> {
    const summaries = await this.prDataService.getAllPrSummariesByUserId(user.user_id);

    return {
      success: true,
      message: `Retrieved ${summaries.length} PR summaries successfully`,
      data: summaries,
    };
  }

  @Get('pr_summary/:pr_summary_id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthCookieGuard)
  async getPrSummaryById(
    @Param('pr_summary_id') prSummaryId: string,
    @CurrentUser() user: { user_id: string },
  ): Promise<{
    success: boolean;
    message: string;
    data: PRReviewResponse;
  }> {
    const summary = await this.prDataService.getPrSummaryById(prSummaryId, user.user_id);

    return {
      success: true,
      message: 'PR summary retrieved successfully',
      data: summary,
    };
  }

    @Get('chat-session/:chat_session_id')
  async getByChatSessionId(
    @Param('chat_session_id') chatSessionId: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: PRReviewResponse;
  }> {
    const summary = await this.prDataService.getSummaryByChatSessionId(chatSessionId);

    return {
      success: true,
      message: 'PR summary',
      data: summary
    }
  }
}