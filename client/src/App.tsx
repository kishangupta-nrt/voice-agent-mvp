import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useVoice, ConversationStyle } from './hooks/useVoice';
import { useAuth, AuthUser } from './hooks/useAuth';
import { VoiceButton } from './components/VoiceButton';
import { StatusDisplay } from './components/StatusDisplay';
import { Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { API_URL } from './config/api';
import { detectLanguage, LANGUAGE_DISPLAY } from './config/languages';
import { AdminPanel } from './admin/AdminPanel';

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
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [detectedStyle, setDetectedStyle] = useState<ConversationStyle | null>(null);
  const { status, interimTranscript, startConversation, stopConversation, speak, isListening, error: voiceError } = useVoice({ detectedLang, detectedStyle });
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [displayError, setDisplayError] = useState<string | null>(null);

  const handleVoiceCallback = useCallback((text: string) => {
    setTranscript(text);
    setApiError(null);
    setDisplayError(null);

    const detected = detectLanguage(text);
    setDetectedLang(detected);

    fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: text,
        conversationId: conversationId,
        language: detected !== 'en' ? detected : undefined,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.error || 'Request failed');
          });
        }
        return res.json();
      })
      .then((data) => {
        setResponse(data.response);
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
        if (data.style) {
          setDetectedStyle(data.style as ConversationStyle);
        }
        return speak(data.response, detected, data.style);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        setApiError(msg);
        setDisplayError(msg);
      });
  }, [conversationId, speak, token]);

  const handleVoice = useCallback(() => {
    if (status !== 'idle') {
      stopConversation();
    } else {
      setTranscript('');
      setResponse('');
      setApiError(null);
      setDisplayError(null);
      startConversation(handleVoiceCallback);
    }
  }, [status, stopConversation, startConversation, handleVoiceCallback]);

  const handleErrorDismiss = useCallback(() => {
    setDisplayError(null);
    setApiError(null);
  }, []);

  useEffect(() => {
    if (voiceError) {
      setDisplayError(voiceError);
    }
  }, [voiceError]);

  return (
    <div className="app">
      <div className="glass-card">
        <div className="header">
          <h1>Voice Agent</h1>
          <p>Talk to Mistral AI</p>
        </div>

        {(detectedLang && detectedLang !== 'en') || detectedStyle ? (
          <div className="language-indicator">
            <span className="lang-dot" />
            <span>
              {detectedLang && detectedLang !== 'en' ? (LANGUAGE_DISPLAY[detectedLang] || detectedLang) : ''}
              {detectedLang && detectedLang !== 'en' && detectedStyle ? ' · ' : ''}
              {detectedStyle ? detectedStyle.charAt(0).toUpperCase() + detectedStyle.slice(1).replace('-', ' ') : ''}
            </span>
          </div>
        ) : null}

        <div className="led-container">
          <div className={`led ${status}`} />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {status === 'error' ? 'Error' : status === 'listening' ? 'Listening' : status === 'speaking' ? 'Speaking' : status === 'thinking' ? 'Thinking' : 'Ready'}
          </span>
        </div>

        <VoiceButton
          status={status}
          onStart={handleVoice}
          onStop={handleVoice}
        />

        <StatusDisplay
          status={status}
          transcript={transcript}
          response={response}
          error={displayError}
          interimTranscript={interimTranscript}
          onDismissError={handleErrorDismiss}
        />

        <div className="hint">
          {isListening ? 'Listening... Speak anytime' : 'Tap to start conversation'}
        </div>
      </div>
    </div>
  );
}

function AppContent({ user, token, logout }: { user: AuthUser; token: string; logout: () => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('voice-app');
    return () => {
      document.body.classList.remove('voice-app');
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={
        <>
          <div className="app">
            <div className="glass-card user-bar">
              <span>{user.email}</span>
              <button onClick={() => navigate('/admin')} className="admin-btn">
                <LayoutDashboard size={14} /> Admin
              </button>
              <button onClick={logout} className="logout-btn">Logout</button>
            </div>
          </div>
          <MainApp token={token} />
        </>
      } />
      <Route path="/admin" element={<AdminPanel userId={user.id} userEmail={user.email} onExit={() => navigate('/')} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
      <BrowserRouter>
        <LoginScreen
          onLogin={handleLogin}
          onRegister={handleRegister}
          loading={loading}
          error={loginError}
        />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppContent user={user} token={token} logout={logout} />
    </BrowserRouter>
  );
}
