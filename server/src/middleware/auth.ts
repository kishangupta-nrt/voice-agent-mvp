import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env.js';

export interface AuthRequest extends Request {
  userId?: string;
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

  if (!ENV.SUPABASE_JWT_SECRET) {
    res.status(500).json({ error: 'Server misconfiguration: JWT secret not set' });
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.SUPABASE_JWT_SECRET) as JwtPayload & { sub: string };
    req.userId = decoded.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};