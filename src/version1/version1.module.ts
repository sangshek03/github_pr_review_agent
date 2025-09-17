import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { UsersModule } from './user_management/users/users.module';
import { AuthModule } from './(auth_management)/auth.module';
import { PrManagementModule } from './pr_management/pr-management.module';
import { PrFetchModule } from './pr_management/pr-fetch/pr-fetch.module';
import { ChatManagementModule } from './chat_management/chat-management.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    PrFetchModule,
    ChatManagementModule,
    RouterModule.register([
      { path: 'api/v1', module: UsersModule },
      { path: 'api/v1', module: AuthModule },
      { path: 'api/v1', module: PrFetchModule },
      { path: 'api/v1', module: ChatManagementModule },
    ]),
  ],
  providers: [],
})
export class Version1Module {}
