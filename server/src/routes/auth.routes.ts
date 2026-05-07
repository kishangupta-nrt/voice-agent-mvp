import { Router } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { ENV } from '../config/env';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const getSupabaseAdmin = (): SupabaseClient => {
  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);
};

const TEST_MODE = ENV.NODE_ENV !== 'production' && (ENV.NODE_ENV === 'test' || process.env.TEST_MODE === 'true');
const TEST_TOKEN = 'test-token-123';
const TEST_USER_ID = '6b350365-8345-48d2-a577-b270762f9091';

router.post('/login', authRateLimit, async (req, res) => {
  // Test mode - bypass auth
  if (TEST_MODE) {
    console.log('🔧 TEST MODE: Auth bypassed');
    return res.json({
      token: TEST_TOKEN,
      user: { id: TEST_USER_ID, email: 'test@example.com' },
    });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase login error:', error.message);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!data.session) {
      return res.status(401).json({ error: 'No session created' });
    }

    res.json({
      token: data.session.access_token,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/register', authRateLimit, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Test mode - bypass auth
  if (TEST_MODE) {
    console.log('🔧 TEST MODE: Register bypassed');
    return res.status(201).json({
      message: 'Test user created',
      user: { id: TEST_USER_ID, email: email },
    });
  }

  try {

    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${ENV.FRONTEND_URL}/verify`,
      },
    });

    if (error) {
      console.error('Registration error:', error.message);
      return res.status(400).json({ error: 'Registration failed. Please try again.' });
    }

    // Send verification email via Resend
    if (data.user && !data.session) {
      res.status(201).json({
        message: 'Account created! Please check your email to verify your account.',
        user: { id: data.user.id, email: data.user.email },
        needsVerification: true,
      });
      return;
    }

    // User created with immediate session (email not required to verify)
    if (data.session && data.user) {
      res.json({
        token: data.session.access_token,
        user: { id: data.user.id, email: data.user.email },
      });
      return;
    }

    if (data.user) {
      res.status(201).json({
        message: 'Account created.',
        user: { id: data.user.id, email: data.user.email },
      });
      return;
    }

    res.status(500).json({ error: 'Registration failed — no user created' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
