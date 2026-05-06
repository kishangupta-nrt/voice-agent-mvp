export type ConversationStyle =
  | 'english'
  | 'hindi'
  | 'hinglish'
  | 'marathi'
  | 'mixed-tech';

const DEVANAGARI = /[\u0900-\u097F]/;
const BENGALI = /[\u0980-\u09FF]/;
const TAMIL = /[\u0B80-\u0BFF]/;
const TELUGU = /[\u0C00-\u0C7F]/;
const GUJARATI = /[\u0A80-\u0AFF]/;
const KANNADA = /[\u0C80-\u0CFF]/;

const TECHNICAL_TERMS = [
  'react', 'next', 'nextjs', 'api', 'ai', 'ml', 'backend', 'frontend',
  'database', 'server', 'cloud', 'aws', 'azure', 'docker', 'kubernetes',
  'saas', 'app', 'mobile', 'ios', 'android', 'web', 'website', 'ecommerce',
  'dashboard', 'admin', 'panel', 'payment', 'integration', 'automation',
  'chatbot', 'llm', 'gpt', 'machine learning', 'deep learning', 'neural',
  'deployment', 'ci/cd', 'git', 'github', 'npm', 'typescript', 'javascript',
  'python', 'node', 'express', 'django', 'flask', 'fastapi', 'postgresql',
  'mongodb', 'redis', 'graphql', 'rest', 'websocket', 'oauth', 'jwt',
  'authentication', 'authorization', 'middleware', 'microservice', 'microservices',
  'responsive', 'seo', 'cms', 'crm', 'erp', 'fintech', 'healthcare', 'startup',
  'ui', 'ux', 'design', 'figma', 'prototype', 'testing', 'agile', 'scrum',
  'devops', 'pipeline', 'container', 'serverless', 'lambda', 'function',
];

const HINDI_LATIN = [
  'hai', 'hun', 'kya', 'aap', 'mujhe', 'nahi', 'karna', 'bataiye', 'kaise', 'madad',
  'chahiye', 'haan', 'achha', 'theek', 'kyun', 'kahan', 'kab', 'kaun', 'tum', 'tera',
  'mera', 'uska', 'iska', 'unko', 'mujhe', 'hum', 'main', 'naam', 'aapka',
  'aapki', 'aapke', 'hain', 'humein', 'bolna', 'baat', 'sun', 'dekho', 'aao', 'jao',
  'karo', 'suno', 'batao', 'pata', 'jaante', 'samajh', 'karein', 'hona', 'jaana', 'aana',
  'bolna', 'dekhna', 'sach', 'website', 'kaise', 'kya', 'hai', 'ho', 'bilkul', 'zaroor',
  'bas', 'sirf', 'aur', 'lekin', 'yaani', 'matlab', 'shayad', 'lagta', 'lagti',
  'karna', 'bana', 'banani', 'banwana', 'banao', 'banega', 'banegi', 'banayenge',
  'karna', 'dekhna', 'sunna', 'samjhana', 'batana', 'puchna', 'bolna', 'likhna',
];

const MARATHI_LATIN = [
  'ahe', 'ahot', 'kaay', 'tumhala', 'mala', 'nahi', 'sangaa', 'madat', 'hava', 'baran',
  'mhanun', 'pan', 'tumhi', 'mi', 'tujhe', 'tula', 'tyala', 'ticha', 'nav', 'bol',
  'bolaa', 'bagha', 'jra', 'khup', 'barach', 'kasa', 'kasa', 'kasel', 'kothe', 'kadhi',
  'karaycha', 'karaychi', 'karayche', 'banavaycha', 'madat', 'havi', 'aamhi', 'tumcha',
];

export interface StyleResult {
  style: ConversationStyle;
  language: string;
  hasTechnical: boolean;
}

export function detectConversationStyle(text: string): StyleResult {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return { style: 'english', language: 'en', hasTechnical: false };

  const hasBengali = BENGALI.test(trimmed);
  const hasTamil = TAMIL.test(trimmed);
  const hasTelugu = TELUGU.test(trimmed);
  const hasGujarati = GUJARATI.test(trimmed);
  const hasKannada = KANNADA.test(trimmed);
  const hasDevanagari = DEVANAGARI.test(trimmed);

  if (hasBengali) return { style: 'english', language: 'bn', hasTechnical: false };
  if (hasTamil) return { style: 'english', language: 'ta', hasTechnical: false };
  if (hasTelugu) return { style: 'english', language: 'te', hasTechnical: false };
  if (hasGujarati) return { style: 'english', language: 'gu', hasTechnical: false };
  if (hasKannada) return { style: 'english', language: 'kn', hasTechnical: false };

  if (hasDevanagari) {
    const words = trimmed.split(/\s+/);
    let hi = 0, mr = 0;
    for (const w of words) {
      if (HINDI_LATIN.some(hw => w.includes(hw))) hi++;
      if (MARATHI_LATIN.some(mw => w.includes(mw))) mr++;
    }
    const isMixed = words.some(w => TECHNICAL_TERMS.includes(w));
    if (mr > hi) return { style: isMixed ? 'mixed-tech' : 'marathi', language: 'mr', hasTechnical: isMixed };
    return { style: isMixed ? 'mixed-tech' : 'hindi', language: 'hi', hasTechnical: isMixed };
  }

  const words = trimmed.split(/\s+/);
  let hiScore = 0;
  let mrScore = 0;
  let techCount = 0;
  let hindiCount = 0;
  let englishCount = 0;

  for (const w of words) {
    if (TECHNICAL_TERMS.includes(w)) {
      techCount++;
      englishCount++;
    }

    if (HINDI_LATIN.includes(w)) {
      hiScore += 2;
      hindiCount++;
    } else if (HINDI_LATIN.some(hw => w.includes(hw) && hw.length > 2)) {
      hiScore += 1;
      hindiCount++;
    }

    if (MARATHI_LATIN.includes(w)) {
      mrScore += 2;
    } else if (MARATHI_LATIN.some(mw => w.includes(mw) && mw.length > 2)) {
      mrScore += 1;
    }

    if (!HINDI_LATIN.includes(w) && !TECHNICAL_TERMS.includes(w)) {
      englishCount++;
    }
  }

  const totalWords = words.length;
  const hasHindi = hiScore >= 2;
  const hasMarathi = mrScore >= 2 && mrScore > hiScore;

  if (hasMarathi) {
    const isMixed = techCount > 0 || (hindiCount > 0 && englishCount > 0);
    return {
      style: isMixed ? 'mixed-tech' : 'marathi',
      language: 'mr',
      hasTechnical: techCount > 0,
    };
  }

  if (hasHindi) {
    const isMixed = techCount > 0 || (hindiCount > 0 && englishCount > 0);
    return {
      style: isMixed ? 'mixed-tech' : 'hinglish',
      language: 'hi',
      hasTechnical: techCount > 0,
    };
  }

  if (techCount > 0 && englishCount < totalWords * 0.5) {
    return { style: 'mixed-tech', language: 'en', hasTechnical: true };
  }

  return { style: 'english', language: 'en', hasTechnical: techCount > 0 };
}
