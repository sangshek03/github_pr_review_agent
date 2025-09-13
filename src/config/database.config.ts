import { ConfigService, registerAs } from '@nestjs/config';

const configService = new ConfigService();

export default registerAs('database', () => ({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USER'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_NAME'),
  schema: configService.get('DB_SCHEMA'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  migrations: [__dirname + '/../../db/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
}));
