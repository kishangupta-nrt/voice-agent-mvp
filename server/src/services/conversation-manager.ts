import type { Customer } from './tools/customer.service';

export interface ConversationContext {
  customer: Customer | null;
  lastIntent: string | null;
  lastTopic: string | null;
  pendingQuestion: string | null;
  slotsCollected: Record<string, string>;
  turnCount: number;
  mentionedNames: string[];
  askedAbout: string[];
  lastAccessed: number;
}

interface TimedContext {
  context: ConversationContext;
  createdAt: number;
}

const conversationContexts = new Map<string, TimedContext>();

const CONTEXT_TTL_MS = 30 * 60 * 1000;
const CONTEXT_MAX_SIZE = 500;
const EVICTION_INTERVAL_MS = 5 * 60 * 1000;
let lastEviction = 0;

const TOPIC_KEYWORDS: Record<string, string[]> = {
  project: ['website', 'web', 'app', 'ai', 'build', 'project', 'product', 'saas', 'platform', 'software', 'system', 'banwani', 'chahiye', 'banana'],
  features: ['feature', 'login', 'payment', 'dashboard', 'need', 'want', 'include', 'must have', 'requirement', 'feature chahiye'],
  budget: ['budget', 'cost', 'price', 'pricing', 'kitna', 'kharcha', 'much', 'expensive', 'affordable', 'range'],
  timeline: ['timeline', 'deadline', 'kitna time', 'long', 'when', 'week', 'month', 'delivery', 'launch', 'fast', 'urgent', 'asap'],
  contact: ['phone', 'email', 'contact', 'reach', 'callback', 'details', 'number', 'whatsapp'],
  meeting: ['meeting', 'call', 'discuss', 'talk', 'consultation', 'baat', 'demo'],
};

const TOPIC_FOLLOWUPS: Record<string, string[]> = {
  project: [
    "What kind of project are you thinking about?",
    "Is it a website, app, or something else?",
    "Tell me more about what you want to build.",
  ],
  features: [
    "What features are most important?",
    "Any specific functionality you need?",
    "What should the user be able to do?",
  ],
  budget: [
    "Do you have a rough budget in mind?",
    "What range are you comfortable with?",
    "Small, medium, or large scale project?",
  ],
  timeline: [
    "When do you need it by?",
    "Any deadline you're working with?",
    "Is this urgent or planned for later?",
  ],
  contact: [
    "What's the best number to reach you?",
    "Should I send details over WhatsApp or email?",
  ],
  meeting: [
    "What day and time works for you?",
    "Morning or evening better for you?",
  ],
};

const TRANSITION_PREFIXES: Record<string, string[]> = {
  website_inquiry: ["Sure", "Got it", "Sounds good", "Alright"],
  app_inquiry: ["Cool", "Got it", "Nice", "Alright"],
  ai_inquiry: ["Interesting", "Got it", "Sure", "Alright"],
  pricing_inquiry: ["Sure", "No problem", "Happy to help", "Got it"],
  timeline_inquiry: ["Depends", "Sure", "Got it"],
  tech_stack_inquiry: ["We use", "Sure", "Good question"],
  schedule_meeting: ["Sure", "Great", "Let's set that up"],
  help: ["Sure thing", "Of course", "Happy to help"],
};

function evictExpired(): void {
  const now = Date.now();
  for (const [key, timed] of conversationContexts.entries()) {
    if (now - timed.context.lastAccessed > CONTEXT_TTL_MS) {
      conversationContexts.delete(key);
    }
  }
}

function enforceMaxSize(): void {
  if (conversationContexts.size > CONTEXT_MAX_SIZE) {
    const sorted = Array.from(conversationContexts.entries())
      .sort((a, b) => a[1].context.lastAccessed - b[1].context.lastAccessed);
    const toRemove = conversationContexts.size - CONTEXT_MAX_SIZE;
    for (let i = 0; i < toRemove; i++) {
      conversationContexts.delete(sorted[i][0]);
    }
  }
}

export class ConversationManager {
  getOrCreate(conversationId: string): ConversationContext {
    const now = Date.now();

    if (now - lastEviction > EVICTION_INTERVAL_MS) {
      evictExpired();
      enforceMaxSize();
      lastEviction = now;
    }

    let timed = conversationContexts.get(conversationId);
    if (!timed) {
      const ctx: ConversationContext = {
        customer: null,
        lastIntent: null,
        lastTopic: null,
        pendingQuestion: null,
        slotsCollected: {},
        turnCount: 0,
        mentionedNames: [],
        askedAbout: [],
        lastAccessed: now,
      };
      conversationContexts.set(conversationId, { context: ctx, createdAt: now });
      return ctx;
    }

    timed.context.lastAccessed = now;
    return timed.context;
  }

  detectTopic(message: string): string | null {
    const lower = message.toLowerCase();
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(k => lower.includes(k))) {
        return topic;
      }
    }
    return null;
  }

  getFollowUp(lastTopic: string | null): string | null {
    if (!lastTopic) return null;
    const followUps = TOPIC_FOLLOWUPS[lastTopic];
    if (!followUps || followUps.length === 0) return null;
    return followUps[Math.floor(Math.random() * followUps.length)];
  }

  updateContext(
    conversationId: string,
    intent?: string,
    topic?: string,
    slot?: { key: string; value: string },
    askedAbout?: string
  ): void {
    const ctx = this.getOrCreate(conversationId);
    ctx.turnCount++;
    ctx.lastAccessed = Date.now();

    if (intent) ctx.lastIntent = intent;
    if (topic) ctx.lastTopic = topic;
    if (slot) {
      ctx.slotsCollected[slot.key] = slot.value;
    }
    if (askedAbout && !ctx.askedAbout.includes(askedAbout)) {
      ctx.askedAbout.push(askedAbout);
    }
  }

  setCustomer(conversationId: string, customer: Customer): void {
    const ctx = this.getOrCreate(conversationId);
    ctx.customer = customer;
    ctx.lastAccessed = Date.now();
    if (customer.name) {
      ctx.mentionedNames.push(customer.name);
    }
  }

  getCustomer(conversationId: string): Customer | null {
    return this.getOrCreate(conversationId).customer;
  }

  clearContext(conversationId: string): void {
    conversationContexts.delete(conversationId);
  }

  formatGreeting(customerName: string | null): string {
    const greetings = [
      "Hey, thanks for calling. What are you looking to build?",
      "Hi there! What kind of project can I help with?",
      "Thanks for reaching out. What do you need?",
      "Hey, what can I help you build today?",
    ];

    if (customerName) {
      return `Hey ${customerName}, thanks for calling. What are you working on?`;
    }

    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  formatConfirmation(action: string): string {
    const confirmations = [
      `Done. ${action}`,
      `Got it. ${action}`,
      `Cool. ${action}`,
      `Alright, ${action}`,
      `No problem, ${action}`,
    ];
    return confirmations[Math.floor(Math.random() * confirmations.length)];
  }

  formatClarification(needed: string): string {
    const clarifications = [
      `Need a bit more info - ${needed}`,
      `${needed}?`,
      `What's the ${needed}?`,
      `Can I get the ${needed}?`,
    ];
    return clarifications[Math.floor(Math.random() * clarifications.length)];
  }

  formatTransition(fromIntent: string): string {
    const prefixes = TRANSITION_PREFIXES[fromIntent] || TRANSITION_PREFIXES.help;
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return `${prefix}.`;
  }
}

export const conversationManager = new ConversationManager();
