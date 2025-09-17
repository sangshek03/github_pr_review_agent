import { IsString, IsUrl, Matches } from 'class-validator';

export class FetchPRDto {
  @IsString()
  @IsUrl()
  @Matches(/^https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+$/, {
    message: 'Invalid GitHub PR URL format. Expected: https://github.com/{owner}/{repo}/pull/{pr_number}',
  })
  pr_url: string;
}

export interface PRMetadata {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  labels: Array<{
    name: string;
    color: string;
    description: string;
  }>;
  base: {
    ref: string;
    sha: string;
  };
  head: {
    ref: string;
    sha: string;
  };
}

export class AnalyzeDTO{
  metadata: any;
  reviews: any;
  comments: any;
  files: any;
}

export interface PRReview {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string;
  state: string;
  submitted_at: string;
}

export interface PRComment {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string;
  created_at: string;
  updated_at: string;
}

export interface PRFile {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  status: string;
  patch?: string;
}

export interface PRDetailsResponse {
  success: boolean;
  message: string;
  data: {
    metadata: PRMetadata;
    reviews: PRReview[];
    comments: PRComment[];
    files: PRFile[];
  };
}

export interface FetchAndSaveResponse {
  success: boolean;
  message: string;
  data: {
    fetchedData: {
      metadata: PRMetadata;
      reviews: PRReview[];
      comments: PRComment[];
      files: PRFile[];
    };
    savedData: {
      prMetadata: any;
      repository: any;
      author: any;
      reviews: any[];
      comments: any[];
      files: any[];
      commits: any[];
    };
  };
}

export interface UserPRsResponse {
  success: boolean;
  message: string;
  data: PRDetailsResponse[];
}