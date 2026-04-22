import dotenv from 'dotenv';

dotenv.config();

const requiredVars = ['SUPABASE_URL', 'SUPABASE_JWT_SECRET'];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0 && process.env.NODE_ENV === 'production') {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
}

export const ENV = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 3001,
  
  // Ollama (local, free)
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'mistral',
  
  // Piper TTS (local, better voice quality)
  PIPER_URL: process.env.PIPER_URL || 'http://localhost:5000',
  
  // Mistral API (cloud, optional fallback)
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || '',
  MISTRAL_MODEL: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  MISTRAL_API_URL: 'https://api.mistral.ai/v1/chat/completions',
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 20,
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
  
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000'],
  
  // Email (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'onboarding@resend.dev',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};
