import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  // Enable CORS for frontend running on port 3000
  app.enableCors({
    origin: 'http://localhost:3000', // or your frontend URL
    credentials: true, // if you need to send cookies
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
