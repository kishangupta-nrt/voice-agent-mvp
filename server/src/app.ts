import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ENV } from './config/env';
import chatRoutes from './routes/chat.routes';
import authRoutes from './routes/auth.routes';
import knowledgeRoutes from './routes/knowledge.routes';

let appVersion = '1.0.0';
try {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));
  appVersion = pkg.version;
} catch {
  // Use default
}

const app: Application = express();

const allowedOrigins = [
  ...ENV.CORS_ORIGINS,
  ...(ENV.VERCEL_URL ? [`https://${ENV.VERCEL_URL}`, `https://${ENV.VERCEL_URL}`] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

app.use(
  '/api/',
  rateLimit({
    windowMs: ENV.RATE_LIMIT_WINDOW_MS,
    max: ENV.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  })
);

app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/knowledge', knowledgeRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: appVersion,
  });
});

const PORT = ENV.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

export default app;
