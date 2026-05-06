export const CASUAL_PREFIXES = [
  { regex: /^yeah/i, insert: ["Yeah, ", "yep, "] },
  { regex: /^okay/i, insert: ["Okay, ", "Alright, ", "Sure, "] },
  { regex: /^sure/i, insert: ["Sure thing, ", "Yep, "] },
  { regex: /^got it/i, insert: ["Gotcha, ", "Got it, "] },
  { regex: /^thanks/i, insert: ["Thanks, ", "Appreciate it, "] },
  { regex: /^sorry/i, insert: ["My bad, ", "Oops, "] },
];

export const CASUAL_RESPONSES = {
  greeting: [
    "Hey, thanks for calling. What can I help with?",
    "Hi there! What's going on?",
    "Thanks for calling. How can I help you today?",
    "Hey! What do you need help with?",
    "Hi, I'm here to help. What's up?",
  ],
  thanks: [
    "No problem.",
    "Sure thing.",
    "You got it.",
    "Anytime.",
    "Happy to help.",
    "No worries at all.",
  ],
  goodbye: [
    "Talk to you later.",
    "Take care.",
    "Bye for now.",
    "Have a good one.",
    "See you later.",
  ],
  clarification: [
    "Could you say that a different way? I want to make sure I understand.",
    "Hmm, not sure I caught that. What did you mean?",
    "Sorry, can you rephrase that for me?",
    "I didn't quite get that. Could you explain a bit more?",
    "Can you tell me more about what you need?",
    "Not sure I follow. Are you asking about something specific?",
    "Could you give me a bit more detail on that?",
    "I want to help - can you clarify what you're looking for?",
    "Not sure I understood. What exactly do you need?",
    "Can you tell me what you're trying to figure out?",
  ],
  waiting: [
    "Hang on.",
    "One sec.",
    "Give me a sec.",
    "Just a sec.",
    "Let me look into that.",
    "Give me a moment.",
  ],
};

export function addCasualPrefix(response: string): string {
  const words = response.split(" ");
  if (words.length < 3) return response;

  for (const { regex, insert } of CASUAL_PREFIXES) {
    if (regex.test(words[0].toLowerCase())) {
      const prefix = insert[Math.floor(Math.random() * insert.length)];
      if (!response.toLowerCase().startsWith(prefix.trim().toLowerCase().replace(",", ""))) {
        return prefix + response.charAt(0).toLowerCase() + response.slice(1);
      }
    }
  }

  return response;
}

export function varyResponse(responses: string[]): string {
  return responses[Math.floor(Math.random() * responses.length)];
}

export function personalizeForCustomer(name: string | null, response: string): string {
  if (!name) return response;

  return response
    .replace(/{name}/g, name)
    .replace(/\bhey\b/gi, `hey ${name}`)
    .replace(/\bhi\b/gi, `hi ${name}`);
}
