import { useState, useEffect, useCallback } from 'react';
import { useVoice, Status } from './hooks/useVoice';
import { useAuth } from './hooks/useAuth';
import { VoiceButton } from './components/VoiceButton';
import { StatusDisplay } from './components/StatusDisplay';
import { Eye, EyeOff } from 'lucide-react';
import { API_URL } from './config/api';

function UnsupportedBrowser() {
  return (
    <div className="app">
      <div className="glass-card unsupported">
        <h2>Unsupported Browser</h2>
        <p>Please use Chrome for voice features.</p>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, onRegister, loading, error }: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setLocalError(null);
    try {
      if (isRegister) {
        await onRegister(email, password);
        setLocalError('Account created! You can now sign in.');
        setIsRegister(false);
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app">
      <div className="glass-card login">
        <h2>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
        <p className="subtitle">Sign in to continue</p>
        
        <div className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="password-input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          {(error || localError) && <div className="error">{error || localError}</div>}
          
          <button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Loading...' : isRegister ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
        
        <p className="toggle">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}

function MainApp({ token }: { token: string }) {
  const { status, error: speechError, isSupported, startListening, stopAll, speak } = useVoice();
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleVoice = useCallback(() => {
    setTranscript('');
    setResponse('');

    startListening(async (text) => {
      setTranscript(text);

      try {
        const res = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            conversationId,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Request failed');
        }

        const data = await res.json();

        setResponse(data.response);
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }

        await speak(data.response);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        setApiError(msg);
        console.error('API error:', err);
      }
    });
  }, [conversationId, startListening, speak, token]);

  return (
    <div className="app">
      <div className="glass-card">
        <div className="header">
          <h1>Voice Agent</h1>
          <p>Talk to Mistral AI</p>
        </div>

        <div className="led-container">
          <div className={`led ${status}`} />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {status === 'error' ? 'Error' : status === 'listening' ? 'Listening' : status === 'speaking' ? 'Speaking' : status === 'thinking' ? 'Thinking' : 'Ready'}
          </span>
        </div>

        <VoiceButton
          status={status}
          onStart={handleVoice}
          onStop={stopAll}
        />

        <StatusDisplay
          status={status}
          transcript={transcript}
          response={response}
          error={speechError || apiError}
        />

        <div className="hint">
          Click the button and speak • Click again to stop
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading, error, login, register, logout, getToken } = useAuth();
  const [browserSupported, setBrowserSupported] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const hasSpeechRecognition =
      'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const hasSpeechSynthesis = 'speechSynthesis' in window;

    setBrowserSupported(hasSpeechRecognition && hasSpeechSynthesis);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      setLoginError(null);
      await login(email, password);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleRegister = async (email: string, password: string) => {
    try {
      setLoginError(null);
      await register(email, password);
      setLoginError('Check your email to confirm your account!');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  if (!browserSupported) {
    return <UnsupportedBrowser />;
  }

  if (loading) {
    return (
      <div className="app">
        <div className="glass-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const token = getToken();
  
  if (!user || !token) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={handleRegister}
        loading={loading}
        error={loginError}
      />
    );
  }

  return (
    <>
      <div className="app">
        <div className="glass-card user-bar">
          <span>{user.email}</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </div>
      <MainApp token={token} />
    </>
  );
}