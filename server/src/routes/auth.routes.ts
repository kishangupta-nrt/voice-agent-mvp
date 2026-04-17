import { Router } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../config/env.js';
import { sendVerificationEmail } from '../services/email.service.js';

const router = Router();

const getSupabaseAdmin = (): SupabaseClient => {
  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);
};

// Test mode - bypass auth for development
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_USER_ID = 'test-user-123';
const TEST_TOKEN = 'test-token-123';

router.post('/login', async (req, res) => {
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

    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase login error:', error.message);
      return res.status(401).json({ error: error.message });
    }

    if (!data.session) {
      return res.status(401).json({ error: 'No session created' });
    }

    res.json({
      token: data.session.access_token,
      user: data.user,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Test mode - bypass auth
  if (TEST_MODE) {
    console.log('🔧 TEST MODE: Register bypassed');
    return res.status(201).json({
      message: 'Test user created',
      user: { id: TEST_USER_ID, email: email || 'test@example.com' },
    });
  }

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

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
      return res.status(400).json({ error: error.message });
    }

    // Send verification email via Resend
    if (data.user && !data.session) {
      // User created but needs email verification
      if (ENV.RESEND_API_KEY && data.user.email) {
        try {
          await sendVerificationEmail(data.user.email, '');
          console.log('📧 Verification email sent to:', data.user.email);
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
        }
      }
      
      res.status(201).json({
        message: 'Account created! Please check your email to verify your account.',
        user: { id: data.user.id, email: data.user.email },
        needsVerification: true,
      });
      return;
    }

    // User created with immediate session (email not required to verify)
    if (data.session) {
      res.json({
        token: data.session.access_token,
        user: data.user,
      });
      return;
    }

    res.status(201).json({
      message: 'Account created.',
      user: data.user,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
