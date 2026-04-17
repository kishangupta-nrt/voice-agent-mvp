import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';

const JWKS_URL = 'https://ywflgzyrdikqhlkjrypy.supabase.co/auth/v1/.well-known/jwks.json';

export interface AuthRequest extends Request {
  userId?: string;
}

// Test mode bypass
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_TOKEN = 'test-token-123';
const TEST_USER_ID = 'test-user-123';

let getKey: ReturnType<typeof createRemoteJWKSet>;

try {
  getKey = createRemoteJWKSet(new URL(JWKS_URL));
} catch (e) {
  console.log('JWKS URL not configured, test mode only');
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Test mode - bypass auth
  if (TEST_MODE) {
    req.userId = TEST_USER_ID;
    next();
    return;
  }

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

  // Test token bypass
  if (token === TEST_TOKEN) {
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
  } catch (err) {
    console.error('JWT verification failed:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};
