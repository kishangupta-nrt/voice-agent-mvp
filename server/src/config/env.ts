import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 3001,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || '',
  MISTRAL_MODEL: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  MISTRAL_API_URL: 'https://api.mistral.ai/v1/chat/completions',
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 20,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
