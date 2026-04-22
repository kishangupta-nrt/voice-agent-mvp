import greetingIntents from './greeting.json';
import faqIntents from './faq.json';
import closingIntents from './closing.json';

export interface Intent {
  id: string;
  name: string;
  triggers: string[];
  priority: number;
  requiresAuth: boolean;
  slots?: string[];
  slotPrompts?: Record<string, string | undefined>;
  response: string;
  followUp?: string | null;
  tool?: string;
}

export interface KnowledgeBase {
  intents: Intent[];
}

export const allIntents: Intent[] = [
  ...greetingIntents.intents,
  ...faqIntents.intents,
  ...closingIntents.intents,
].sort((a, b) => b.priority - a.priority);

export function detectIntent(message: string): Intent | null {
  const lower = message.toLowerCase().trim();
  const words = lower.split(/\s+/);

  for (const intent of allIntents) {
    for (const trigger of intent.triggers) {
      const triggerLower = trigger.toLowerCase();
      if (lower.includes(triggerLower) || words.some(w => w === triggerLower)) {
        return intent;
      }
    }
  }

  return null;
}

export { greetingIntents, faqIntents };