import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';
import { ENV } from '../config/env';

export interface AuthRequest extends Request {
  userId?: string;
}

const TEST_MODE = ENV.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
const TEST_TOKEN = 'test-token-123';
const TEST_USER_ID = '6b350365-8345-48d2-a577-b270762f9091';

let getKey: ReturnType<typeof createRemoteJWKSet>;

if (ENV.SUPABASE_URL) {
  try {
    getKey = createRemoteJWKSet(new URL(`${ENV.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  } catch {
    console.log('JWKS init failed, test mode only');
  }
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  if (TEST_MODE && token === TEST_TOKEN) {
    req.userId = TEST_USER_ID;
    next();
    return;
  }

  try {
    if (!getKey) {
      res.status(500).json({ error: 'Auth not configured' });
      return;
    }

    const { payload } = await jwtVerify(token, getKey, {
      algorithms: ['ES256'],
    });
    req.userId = (payload as JWTPayload & { sub: string }).sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
