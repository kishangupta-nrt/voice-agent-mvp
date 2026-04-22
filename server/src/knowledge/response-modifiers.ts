export const CASUAL_PREFIXES = [
  { regex: /^yeah/i, insert: ["Yeah, ", "yep, "] },
  { regex: /^okay/i, insert: ["Okay, ", "Alright, ", "Sure, "] },
  { regex: /^sure/i, insert: ["Sure thing, ", "Yep, "] },
  { regex: /^got it/i, insert: ["Gotcha, ", "Got it, "] },
  { regex: /^thanks/i, insert: ["Thanks, ", "Appreciate it, "] },
  { regex: /^sorry/i, insert: ["My bad, ", "Oops, "] },
];

export const FILLER_WORDS = [
  { trigger: "thinking", words: ["uh", "um", "let me think", "hang on"] },
  { trigger: "searching", words: ["looking", "checking", "finding"] },
  { trigger: "confirmation", words: ["got it", "cool", "alright", "done"] },
];

export const CASUAL_RESPONSES = {
  greeting: [
    "Hey, thanks for calling.",
    "Hi there.",
    "Thanks for calling. What's up?",
  ],
  thanks: [
    "No problem.",
    "Sure thing.",
    "You got it.",
    "Anytime.",
  ],
  goodbye: [
    "Talk to you later.",
    "Take care.",
    "Bye for now.",
  ],
  clarification: [
    "What's that?",
    "Can you say that again?",
    "What do you mean?",
  ],
  waiting: [
    "Hang on.",
    "One sec.",
    "Give me a sec.",
    "Just a sec.",
  ],
};

export const TOPIC_CHECKS = [
  { topic: "order", check: "Are you tracking an order or something?", variations: ["Need help with an order?", "Want to check an order status?"] },
  { topic: "return", check: "Returning something?", variations: ["Got the item info?", "What's the item?"] },
  { topic: "billing", check: "Question about billing?", variations: ["Need pricing info?", "Want me to send rates?"] },
  { topic: "support", check: "What's going on?", variations: ["Can you tell me more?", "What's the issue?"] },
];

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

export function addThinkingDelay(response: string, probability = 0.1): string {
  if (Math.random() > probability) return response;
  
  const fillers = ["let me think, ", "hang on, ", "checking that, "];
  const filler = fillers[Math.floor(Math.random() * fillers.length)];
  
  return filler + response.charAt(0).toLowerCase() + response.slice(1);
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