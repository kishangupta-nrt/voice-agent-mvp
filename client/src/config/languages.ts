const DEVANAGARI = /[\u0900-\u097F]/;
const HINDI_NATIVE = ['है', 'हूँ', 'क्या', 'आप', 'मुझे', 'नहीं', 'करना', 'बताइए', 'कैसे', 'मदद', 'चाहिए', 'हाँ', 'अच्छा', 'ठीक'];
const MARATHI_NATIVE = ['आहे', 'आहोत', 'काय', 'तुम्हाला', 'मला', 'नाही', 'करायचं', 'सांगा', 'मदत', 'हवं', 'बरं', 'म्हणून'];
const BENGALI = /[\u0980-\u09FF]/;
const TAMIL = /[\u0B80-\u0BFF]/;
const TELUGU = /[\u0C00-\u0C7F]/;
const GUJARATI = /[\u0A80-\u0AFF]/;
const KANNADA = /[\u0C80-\u0CFF]/;

const HINDI_LATIN = [
  'hai', 'hun', 'kya', 'aap', 'mujhe', 'nahi', 'karna', 'bataiye', 'kaise', 'madad',
  'chahiye', 'haan', 'achha', 'theek', 'kyun', 'kahan', 'kab', 'kaun', 'tum', 'tera',
  'mera', 'uska', 'iska', 'unko', 'mujhe', 'hum', 'main', 'naam', 'kya', 'aapka',
  'aapki', 'aapke', 'hain', 'humein', 'bolna', 'baat', 'sun', 'dekho', 'aao', 'jao',
  'karo', 'suno', 'batao', 'pata', 'jaante', 'samajh', 'karein', 'hona', 'jaana', 'aana',
  'bolna', 'dekhna', 'sach', 'problem', 'website', 'kaise', 'kya', 'hai', 'ho',
];

const MARATHI_LATIN = [
  'ahe', 'ahot', 'kaay', 'tumhala', 'mala', 'nahi', 'sangaa', 'madat', 'hava', 'baran',
  'mhanun', 'pan', 'tumhi', 'mi', 'tujhe', 'tula', 'tyala', 'ticha', 'nav', 'bol',
  'bolaa', 'bagha', 'jra', 'khup', 'barach', 'kasa', 'kasa', 'kasel', 'kothe', 'kadhi',
];

const INDIC_SCRIPTS = [
  { test: (t: string) => BENGALI.test(t), lang: 'bn' },
  { test: (t: string) => TAMIL.test(t), lang: 'ta' },
  { test: (t: string) => TELUGU.test(t), lang: 'te' },
  { test: (t: string) => GUJARATI.test(t), lang: 'gu' },
  { test: (t: string) => KANNADA.test(t), lang: 'kn' },
];

export function detectLanguage(text: string): string {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return 'en';

  for (const { test, lang } of INDIC_SCRIPTS) {
    if (test(trimmed)) return lang;
  }

  if (DEVANAGARI.test(trimmed)) {
    const words = trimmed.split(/\s+/);
    let hi = 0, mr = 0;
    for (const w of words) {
      if (HINDI_NATIVE.some(hw => w.includes(hw))) hi++;
      if (MARATHI_NATIVE.some(mw => w.includes(mw))) mr++;
    }
    return mr > hi ? 'mr' : 'hi';
  }

  const words = trimmed.split(/\s+/);
  let hiScore = 0;
  let mrScore = 0;

  for (const w of words) {
    if (HINDI_LATIN.includes(w)) hiScore += 2;
    else if (HINDI_LATIN.some(hw => w.includes(hw) && hw.length > 2)) hiScore += 1;

    if (MARATHI_LATIN.includes(w)) mrScore += 2;
    else if (MARATHI_LATIN.some(mw => w.includes(mw) && mw.length > 2)) mrScore += 1;
  }

  if (mrScore > hiScore && mrScore >= 2) return 'mr';
  if (hiScore >= 2) return 'hi';

  return 'en';
}

export const LANGUAGE_DISPLAY: Record<string, string> = {
  en: 'English', hi: 'हिन्दी', mr: 'मराठी', bn: 'বাংলা',
  ta: 'தமிழ்', te: 'తెలుగు', gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ',
};
