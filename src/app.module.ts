import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppConfig, DatabaseConfig } from './config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Version1Module } from './version1/version1.module';
import { JwtMiddleware } from './middleware/jwt.middleware';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from './version1/user_management/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [AppConfig, DatabaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
      inject: [ConfigService],
    }),
    JwtModule.register({}),
    Version1Module,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtMiddleware)
      .exclude(
        // { path: '/api/v1/auth/login', method: RequestMethod.POST }, // Forgot
        { path: '/api/v1/auth', method: RequestMethod.POST }, // Login
        { path: '/api/v1/users', method: RequestMethod.POST }, // SignUp
        { path: '/api/v1/auth/google', method: RequestMethod.GET }, // SignUp
        { path: '/api/v1/auth/google/callback', method: RequestMethod.GET }, // SignUp
        { path: '/health', method: RequestMethod.GET }, // SignUp
        { path: '/api/v1/auth/forgot', method: RequestMethod.POST }, // Forgot
        { path: '/api/v1/auth/changepass', method: RequestMethod.PUT }, // ChangePassword
        { path: '/api/v1/auth/verify-otp', method: RequestMethod.POST }, // Verify OTP
        { path: '/api/v1/auth/verify', method: RequestMethod.GET }, // Email Verify (GET)
        { path: '/api/v1/auth/logout', method: RequestMethod.GET }, //Logout
        { path: '/api/v1/pr/fetch', method: RequestMethod.POST }, // PR Fetch
        { path: '/api/v1/pr/analyze', method: RequestMethod.POST }, // PR Analysis
      )
      .forRoutes('*');
  }
}
