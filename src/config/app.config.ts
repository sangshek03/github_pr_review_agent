import { ConfigService, registerAs } from '@nestjs/config';

const configService = new ConfigService();

export default registerAs('config', () => ({
  port: configService.get('PORT'),
  nodenv: process.env.NODE_ENV,
}));
