import { ConfigService, registerAs } from '@nestjs/config';

const configService = new ConfigService();

export default registerAs('config', () => ({
  port: configService.get('PORT'),
  nodenv: process.env.NODE_ENV,
  // JWT Configuration
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'your-jwt-access-secret-key',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret-key',
  // Google OAuth Configuration
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  // Encryption Configuration
  encryptionSecret: process.env.ENCRYPTION_SECRET || 'your-encryption-secret-key',
  // OpenAI Configuration
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
}));
