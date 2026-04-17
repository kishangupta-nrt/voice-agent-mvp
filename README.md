# Voice Agent MVP

A zero-cost, privacy-first voice AI agent powered by local LLM.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| AI | Ollama (Mistral) or Mistral API |
| Database | Supabase PostgreSQL |
| Speech | Web Speech API (Chrome) |

**Cost:** $0 | **Privacy:** Local AI | **Browser:** Chrome/Edge

---

## Prerequisites

### 1. Node.js 18+
```bash
node --version
```

### 2. Ollama with Mistral model (Recommended)
```bash
# Install: https://ollama.com/download

# Pull model
ollama pull mistral

# Keep running (in background or separate terminal)
ollama serve
```

### 3. Supabase Database
1. Create project at https://supabase.com
2. Run `database/schema.sql` in SQL Editor
3. Copy credentials to `.env`

### 4. Chrome Browser
Required for Web Speech API (microphone access)

---

## Quick Start

```bash
# 1. Install dependencies
npm run install:all

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your Supabase credentials

# 3. Start backend (Terminal 1)
npm run dev:server

# 4. Start frontend (Terminal 2)
npm run dev:client
```

Or run both together:
```bash
npm run dev
```

Open http://localhost:5173 in Chrome.

---

## Environment Setup

### Server (.env)

```env
PORT=3001

# Ollama (Local - Recommended)
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=mistral

# OR Mistral API (Cloud - Fallback)
# MISTRAL_API_KEY=your_key_here
# MISTRAL_MODEL=mistral-small-latest

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
```

### Client (.env)
```env
VITE_API_URL=http://localhost:3001/api
```

---

## Database Setup

1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from `database/schema.sql`
3. This creates:
   - `conversations` table
   - `messages` table
   - Row Level Security (RLS) policies

---

## Commands

```bash
npm run install:all   # Install all dependencies
npm run dev           # Run both server + client
npm run dev:server    # Run backend only (:3001)
npm run dev:client    # Run frontend only (:5173)
npm run build         # Build for production
npm run start         # Start production server
```

---

## How It Works

### Voice Conversation Loop
```
Tap Button → Listening → Speak → Thinking → Speaking → Listening...
```

1. **Tap to Start** - Begins conversation loop
2. **Speak** - Your words are transcribed in real-time
3. **Pause** - After 700ms silence, your speech is sent to AI
4. **Think** - AI processes your request
5. **Speak** - AI response is spoken aloud
6. **Auto-Listen** - After speaking, automatically listens again
7. **Tap to Stop** - Ends conversation gracefully

### Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Chrome    │────▶│   React     │────▶│   Express   │
│   Browser   │◀────│   App       │◀────│   Server    │
│  (Mic/Spk)  │     │             │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐             │
                    │   Ollama    │◀────────────┘
                    │  (Mistral)  │
                    └─────────────┘
```

---

## Features

- **Voice Input** - Speech recognition with silence detection
- **Voice Output** - Text-to-speech AI responses
- **Conversation Memory** - Full conversation context
- **Auto-Resume** - Automatically listens after AI speaks
- **Error Recovery** - Continues listening after errors
- **Rate Limiting** - 20 requests per minute
- **Offline UI** - PWA shell works offline
- **User Auth** - Supabase authentication

---

## Project Structure

```
voice-agent-mvp/
├── package.json           # Root scripts
├── server/                # Express backend
│   ├── src/
│   │   ├── app.ts         # Server entry
│   │   ├── config/        # Env & constants
│   │   ├── controllers/   # Route handlers
│   │   ├── services/      # LLM & chat logic
│   │   ├── repositories/  # Database ops
│   │   └── routes/        # API routes
│   └── .env               # Environment
├── client/                # React frontend
│   └── src/
│       ├── App.tsx        # Main app
│       ├── hooks/         # useVoice, useAuth
│       ├── components/    # UI components
│       └── styles/        # CSS
├── database/
│   └── schema.sql         # Supabase schema
└── README.md
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message, get AI response |
| `/api/chat` | GET | Get conversation history |
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Sign in |
| `/api/health` | GET | Health check |

---

## Troubleshooting

### "Cannot connect to Ollama"
```bash
# Make sure Ollama is running
ollama serve

# Check model is installed
ollama list
```

### "Microphone not working"
- Use Chrome browser
- Allow microphone permission when prompted
- Check microphone is not in use by another app

### "Speech not recognized"
- Speak clearly in English
- Wait 700ms after speaking before it sends
- Check microphone is working

### "Rate limit exceeded"
- Wait 60 seconds
- 20 requests per minute limit

### "Database error"
- Verify Supabase credentials in `.env`
- Run `database/schema.sql` in Supabase SQL Editor

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OLLAMA_URL` | Ollama endpoint | Yes (or MISTRAL_API_KEY) |
| `OLLAMA_MODEL` | Model name | Yes (or MISTRAL_API_KEY) |
| `MISTRAL_API_KEY` | Mistral API key | Yes (or OLLAMA_URL) |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_KEY` | Supabase service role key | Yes |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret | Yes |

---

## License

MIT
