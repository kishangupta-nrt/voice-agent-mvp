import type { ConversationContext } from './conversation-manager';

export type LeadStage = 'new' | 'qualifying' | 'warm' | 'ready-to-close';

export interface LeadState {
  projectType: string | null;
  features: string[];
  budget: string | null;
  timeline: string | null;
  companyType: string | null;
  leadStage: LeadStage;
  contactInfo: { phone?: string; email?: string };
  preferredLanguage: string | null;
}

const PROJECT_TYPE_PATTERNS: Record<string, RegExp[]> = {
  website: [/website/i, /web\s*site/i, /landing\s*page/i, /web\s*app/i, /e-?commerce/i, /online\s*store/i, /website.*banwani/i, /website.*chahiye/i],
  app: [/mobile\s*app/i, /android\s*app/i, /ios\s*app/i, /app\s*banwani/i, /app\s*chahiye/i, /react\s*native/i, /flutter\s*app/i, /mobile\s*application/i],
  ai: [/\bai\b/i, /artificial\s*intelligence/i, /chatbot/i, /voice\s*agent/i, /automation/i, /machine\s*learning/i, /ai\s*solution/i, /chatbot.*chahiye/i, /automation.*chahiye/i],
};

const FEATURE_PATTERNS = [
  /login/i, /auth/i, /sign\s*in/i, /sign\s*up/i, /register/i,
  /payment/i, /stripe/i, /razorpay/i, /checkout/i,
  /dashboard/i, /admin/i, /panel/i,
  /notification/i, /push/i, /email/i, /sms/i,
  /search/i, /filter/i, /sort/i,
  /upload/i, /download/i, /file/i,
  /chat/i, /messaging/i, /real.?time/i,
  /analytics/i, /report/i, /stats/i,
  /profile/i, /setting/i, /account/i,
];

const BUDGET_PATTERNS = [
  /(?:budget|price|cost|kitna|kharcha|rate)\s*[:\s]*(₹?\s*[\d,]+(?:\s*[-–]\s*₹?\s*[\d,]+)?)/i,
  /(₹?\s*[\d,]+(?:\s*[-–]\s*₹?\s*[\d,]+)?(?:\s*(?:lakh|k|thousand|lac)))/i,
];

const TIMELINE_PATTERNS = [
  /(?:timeline|deadline|deliver|launch|need.*by|want.*in)\s*[:\s]*(.+)/i,
  /([\d]+\s*(?:week|month|day)s?)/i,
  /(?:asap|urgent|fast|quick|soon)/i,
];

const COMPANY_PATTERNS: Record<string, RegExp[]> = {
  startup: [/startup/i, /new\s*business/i, /mvp/i, /idea/i, /just\s*starting/i, /early\s*stage/i],
  enterprise: [/enterprise/i, /large\s*company/i, /corporate/i, /organization/i, /company\s*of/i, /firm/i],
  agency: [/agency/i, /freelance/i, /consultant/i, /studio/i],
};

const CONTACT_PATTERNS = {
  phone: [/phone\s*(?:number)?\s*[:\s]*([+\d\s-]{7,})/i, /mobile\s*[:\s]*([+\d\s-]{7,})/i, /call\s*me\s*at\s*([+\d\s-]{7,})/i, /(?:number|no)\s*[:\s]*([+\d\s-]{7,})/i],
  email: [/email\s*[:\s]*([\w.+-]+@[\w-]+\.[\w.]+)/i, /mail\s*[:\s]*([\w.+-]+@[\w-]+\.[\w.]+)/i],
};

const TTL_MS = 30 * 60 * 1000;
const EVICTION_INTERVAL_MS = 5 * 60 * 1000;

interface TimedState {
  state: LeadState;
  lastAccessed: number;
}

const states = new Map<string, TimedState>();
let lastEviction = 0;

function evictExpired(): void {
  const now = Date.now();
  for (const [key, timed] of states.entries()) {
    if (now - timed.lastAccessed > TTL_MS) {
      states.delete(key);
    }
  }
}

function enforceMaxSize(): void {
  if (states.size > 500) {
    const sorted = Array.from(states.entries()).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    const toRemove = states.size - 500;
    for (let i = 0; i < toRemove; i++) {
      states.delete(sorted[i][0]);
    }
  }
}

function extractFeatures(text: string): string[] {
  const found: string[] = [];
  for (const pattern of FEATURE_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) found.push(match[0].trim());
    }
  }
  return found;
}

function extractValue(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

function advanceStage(state: LeadState): void {
  if (state.leadStage === 'new' && state.projectType) {
    state.leadStage = 'qualifying';
  } else if (state.leadStage === 'qualifying' && (state.features.length > 0 || state.budget)) {
    state.leadStage = 'warm';
  } else if (state.leadStage === 'warm' && (state.contactInfo.phone || state.contactInfo.email)) {
    state.leadStage = 'ready-to-close';
  }
}

class LeadTracker {
  getOrCreate(conversationId: string): LeadState {
    const now = Date.now();

    if (now - lastEviction > EVICTION_INTERVAL_MS) {
      evictExpired();
      enforceMaxSize();
      lastEviction = now;
    }

    let timed = states.get(conversationId);
    if (!timed) {
      const state: LeadState = {
        projectType: null,
        features: [],
        budget: null,
        timeline: null,
        companyType: null,
        leadStage: 'new',
        contactInfo: {},
        preferredLanguage: null,
      };
      states.set(conversationId, { state, lastAccessed: now });
      return state;
    }

    timed.lastAccessed = now;
    return timed.state;
  }

  update(conversationId: string, message: string, intentId?: string): LeadState {
    const state = this.getOrCreate(conversationId);
    const lower = message.toLowerCase();

    if (!state.projectType) {
      for (const [type, patterns] of Object.entries(PROJECT_TYPE_PATTERNS)) {
        if (patterns.some(p => p.test(message))) {
          state.projectType = type;
          break;
        }
      }
    }

    const newFeatures = extractFeatures(message);
    for (const f of newFeatures) {
      if (!state.features.includes(f)) {
        state.features.push(f);
      }
    }

    if (!state.budget) {
      const budget = extractValue(message, BUDGET_PATTERNS);
      if (budget) state.budget = budget;
    }

    if (!state.timeline) {
      const timeline = extractValue(message, TIMELINE_PATTERNS);
      if (timeline) state.timeline = timeline;
    }

    if (!state.companyType) {
      for (const [type, patterns] of Object.entries(COMPANY_PATTERNS)) {
        if (patterns.some(p => p.test(message))) {
          state.companyType = type;
          break;
        }
      }
    }

    if (!state.contactInfo.phone) {
      const phone = extractValue(message, CONTACT_PATTERNS.phone);
      if (phone) state.contactInfo.phone = phone;
    }

    if (!state.contactInfo.email) {
      const email = extractValue(message, CONTACT_PATTERNS.email);
      if (email) state.contactInfo.email = email;
    }

    if (intentId === 'collect_contact') {
      if (state.contactInfo.phone && state.contactInfo.email && state.leadStage !== 'ready-to-close') {
        state.leadStage = 'ready-to-close';
      }
    }

    advanceStage(state);

    return state;
  }

  getState(conversationId: string): LeadState | null {
    const timed = states.get(conversationId);
    if (!timed) return null;
    timed.lastAccessed = Date.now();
    return timed.state;
  }

  setLanguage(conversationId: string, language: string): void {
    const state = this.getOrCreate(conversationId);
    state.preferredLanguage = language;
  }

  clear(conversationId: string): void {
    states.delete(conversationId);
  }

  formatForPrompt(state: LeadState | null): string {
    if (!state || state.leadStage === 'new') return '';

    const lines: string[] = ['--- Lead Context ---'];

    if (state.projectType) lines.push(`Project type: ${state.projectType}`);
    if (state.features.length > 0) lines.push(`Features discussed: ${state.features.join(', ')}`);
    if (state.budget) lines.push(`Budget: ${state.budget}`);
    if (state.timeline) lines.push(`Timeline: ${state.timeline}`);
    if (state.companyType) lines.push(`Company type: ${state.companyType}`);
    if (state.contactInfo.phone) lines.push(`Phone: ${state.contactInfo.phone}`);
    if (state.contactInfo.email) lines.push(`Email: ${state.contactInfo.email}`);
    lines.push(`Lead stage: ${state.leadStage}`);
    lines.push('--- End Lead Context ---');

    return lines.join('\n');
  }

  getAllActive(): Map<string, LeadState> {
    const result = new Map<string, LeadState>();
    for (const [key, timed] of states.entries()) {
      result.set(key, timed.state);
    }
    return result;
  }
}

export const leadTracker = new LeadTracker();
