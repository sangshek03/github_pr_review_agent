import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { UsersModule } from './user_management/users/users.module';
import { AuthModule } from './(auth_management)/auth.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    RouterModule.register([
      { path: 'api/v1', module: UsersModule },
      { path: 'api/v1', module: AuthModule },
    ]),
  ],
  providers: [],
})
export class Version1Module {}
