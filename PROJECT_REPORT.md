# Voice Agent MVP - Complete Working Report

**Project:** Voice AI Agent  
**Version:** 3.0.0  
**Date:** April 16, 2026  
**Status:** Production Ready

---

## Executive Summary

A zero-cost, privacy-first voice AI agent with a clean conversation loop architecture:

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + TypeScript
- **AI:** Ollama (Mistral) or Mistral API
- **Database:** Supabase PostgreSQL
- **Speech:** Web Speech API (Chrome)

**Cost:** $0 | **Privacy:** Local AI Option | **Browser:** Chrome/Edge

---

## Architecture

### Clean Voice Conversation Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CONVERSATION LOOP                               │
│                                                                     │
│    ┌──────────┐                                                    │
│    │   IDLE   │◀─────────────────────────────────────────┐        │
│    └────┬─────┘                                             │        │
│         │ tap                                              │        │
│         ▼                                                   │        │
│    ┌──────────┐     ┌──────────┐     ┌──────────┐          │        │
│    │LISTENING │────▶│ THINKING │────▶│ SPEAKING │──────────┘        │
│    └────┬─────┘     └────┬─────┘     └────┬─────┘                   │
│         │               │               │                           │
│         │               │               │ utterance.onend           │
│         │               │               ▼                           │
│         │               │         (auto-resume)                     │
│         │               │               │                           │
│         │               │               ▼                           │
│         └───────────────┴──────────▶ LISTENING                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### System Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Chrome     │────▶│   React     │────▶│   Express   │
│   Browser    │◀────│   App       │◀────│   Server    │
│  (Mic/Spk)   │     │             │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐             │
                    │   Ollama    │◀───────────┘
                    │  (Mistral)  │
                    └─────────────┘
```

---

## Voice Hook Architecture

### Golden Rules

| Rule | Implementation |
|------|----------------|
| No restart in `recognition.onend` | Recognition is just input |
| Only restart in `utterance.onend` | State machine controls flow |
| Single source of truth | `isActiveRef` boolean |
| No flag juggling | Simple state machine |

### Key Refs

| Ref | Purpose |
|-----|---------|
| `isActiveRef` | Controls conversation loop (single source of truth) |
| `isListeningRef` | Guards against double-start |
| `interimRef` | Stores interim speech for silence detection |

### State Machine

| State | Trigger | Guards |
|-------|---------|--------|
| `idle` | Initial | - |
| `listening` | `startConversation()` | Double-start protection |
| `thinking` | `onResult()` | Recognition stopped |
| `speaking` | `speak()` | TTS started |
| `error` | Error event | Shows message, recovers |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI Framework |
| TypeScript | 5.4.5 | Type Safety |
| Vite | 5.2.0 | Build Tool |
| Web Speech API | Native | STT + TTS |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 4.19.2 | HTTP Server |
| TypeScript | 5.4.5 | Type Safety |
| Supabase-js | 2.39.0 | Database Client |
| Ollama/Mistral | Latest | LLM Provider |

---

## Features

### Voice Features
| Feature | Status | Description |
|---------|--------|-------------|
| Voice Input | ✅ | Web Speech API recognition |
| Silence Detection | ✅ | 700ms timeout |
| Voice Output | ✅ | Text-to-speech synthesis |
| Auto-Resume | ✅ | Listens after AI speaks |
| Error Recovery | ✅ | Continues on API failure |
| Double-Start Guard | ✅ | Prevents multiple starts |

### Security Features
| Feature | Status | Description |
|---------|--------|-------------|
| Rate Limiting | ✅ | 20 req/min per IP |
| Input Sanitization | ✅ | Trim + 1000 char limit |
| Timeout Handling | ✅ | 60s LLM timeout |
| CORS | ✅ | Configured origins |
| JWT Auth | ✅ | Supabase authentication |
| RLS Policies | ✅ | Row-level security |

### Persistence
| Feature | Status | Description |
|---------|--------|-------------|
| Conversation ID | ✅ | Tracks threads |
| Message History | ✅ | User + assistant |
| User Auth | ✅ | Supabase auth |

---

## Project Structure

```
voice-agent-mvp/
│
├── package.json                    # Root scripts
│
├── server/                         # Backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                       # Environment
│   ├── .env.example               # Template
│   └── src/
│       ├── app.ts                  # Entry point
│       ├── config/
│       │   ├── env.ts             # Environment config
│       │   └── constants.ts       # System prompt
│       ├── controllers/
│       │   └── chat.controller.ts
│       ├── services/
│       │   ├── chat.service.ts
│       │   └── llm.service.ts     # Ollama + Mistral
│       ├── repositories/
│       │   └── chat.repository.ts # Supabase
│       ├── routes/
│       │   ├── chat.routes.ts
│       │   └── auth.routes.ts
│       └── middleware/
│           └── auth.ts             # JWT verification
│
├── client/                         # Frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── .env
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 # Main app
│       ├── vite-env.d.ts
│       ├── styles/
│       │   └── globals.css
│       ├── hooks/
│       │   ├── useVoice.ts        # Voice recognition
│       │   └── useAuth.ts         # Authentication
│       └── components/
│           ├── VoiceButton.tsx
│           └── StatusDisplay.tsx
│
├── database/
│   └── schema.sql                 # Supabase schema
│
├── dist/                           # Production build
│
├── README.md                       # Quick start guide
└── PROJECT_REPORT.md              # This report
```

---

## API Endpoints

### POST /api/chat
```json
// Request
{
  "message": "Hello, how are you?",
  "conversationId": "optional-uuid"
}

// Response
{
  "response": "I'm doing well, thank you!",
  "conversationId": "uuid"
}
```

### GET /api/chat
Returns conversation history.

### POST /api/auth/register
Creates user account with email verification.

### POST /api/auth/login
Returns JWT token for API authentication.

### GET /api/health
```json
{
  "status": "ok",
  "timestamp": "2026-04-16T00:00:00Z"
}
```

---

## Database Schema

### conversations
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | FK → auth.users |
| created_at | TIMESTAMP | DEFAULT NOW() |

### messages
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| conversation_id | UUID | FK → conversations |
| user_id | UUID | FK → auth.users |
| role | TEXT | 'user' OR 'assistant' |
| content | TEXT | NOT NULL |
| duration_ms | INTEGER | Response time |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

## Installation & Setup

### Prerequisites
1. Node.js 18+
2. Ollama with Mistral model
3. Chrome Browser
4. Supabase project

### Quick Start
```bash
# Install dependencies
npm run install:all

# Configure environment
cp server/.env.example server/.env
# Edit with your Supabase credentials

# Start backend
npm run dev:server

# Start frontend
npm run dev:client
```

---

## Environment Variables

### Server
| Variable | Description | Required |
|----------|-------------|----------|
| `OLLAMA_URL` | Ollama endpoint | Yes |
| `OLLAMA_MODEL` | Model name | Yes |
| `MISTRAL_API_KEY` | Mistral API | Fallback |
| `SUPABASE_URL` | Supabase project | Yes |
| `SUPABASE_KEY` | Supabase key | Yes |
| `SUPABASE_JWT_SECRET` | JWT secret | Yes |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to Ollama" | Run `ollama serve` |
| "Microphone not working" | Use Chrome, allow permission |
| "Rate limit exceeded" | Wait 60 seconds |
| "Database error" | Check Supabase credentials |

---

## Version History

### v3.0.0 (Current)
- Clean conversation loop architecture
- Single restart point (utterance.onend)
- Error recovery with auto-resume
- Ollama + Mistral support

### v2.0.0
- Supabase authentication
- Conversation persistence
- PWA support

### v1.0.0
- Basic voice chat with Mistral

---

## Credits

Built with:
- [Ollama](https://ollama.com) - Local LLM runtime
- [Mistral AI](https://mistral.ai) - Language model
- [Supabase](https://supabase.com) - Database & Auth
- [React](https://react.dev) - UI framework
- [Vite](https://vitejs.dev) - Build tool

---

**Report Generated:** April 16, 2026  
**Project Status:** Production Ready
