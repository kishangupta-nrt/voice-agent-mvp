import { useRef, useState, useCallback, useEffect } from 'react';

export type ConversationStyle = 'english' | 'hindi' | 'hinglish' | 'marathi' | 'mixed-tech';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface UseVoiceReturn {
  status: Status;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  isListening: boolean;
  startConversation: (onResult: (text: string) => void) => void;
  stopConversation: () => void;
  speak: (text: string, language: string, style?: ConversationStyle) => Promise<void>;
}

interface UseVoiceOptions {
  detectedLang?: string | null;
  detectedStyle?: ConversationStyle | null;
}

const BASE_SILENCE_DELAY = 1000;
const MAX_SILENCE_DELAY = 2000;
const MIN_SILENCE_DELAY = 800;

const getAdaptiveSilenceDelay = (wordCount: number, speechDurationMs: number): number => {
  let delay = BASE_SILENCE_DELAY;

  if (wordCount <= 3) {
    delay = MIN_SILENCE_DELAY + (wordCount * 50);
  } else if (wordCount <= 8) {
    delay = 1000 + ((wordCount - 3) * 100);
  } else {
    delay = 1500 + Math.min((wordCount - 8) * 50, 500);
  }

  if (speechDurationMs > 3000) {
    delay += 300;
  }

  return Math.min(Math.max(delay, MIN_SILENCE_DELAY), MAX_SILENCE_DELAY);
};

const DEVANAGARI = /[\u0900-\u097F]/;
const BENGALI = /[\u0980-\u09FF]/;
const TAMIL = /[\u0B80-\u0BFF]/;
const TELUGU = /[\u0C00-\u0C7F]/;
const GUJARATI = /[\u0A80-\u0AFF]/;
const KANNADA = /[\u0C80-\u0CFF]/;

const getBcp47 = (lang: string): string => {
  const map: Record<string, string> = {
    hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN',
    bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN',
  };
  return map[lang] || 'en-US';
};

const getTtsRate = (style: ConversationStyle | null, lang: string): number => {
  const rateMap: Record<string, number> = {
    'english': 1.0,
    'hindi': 0.85,
    'hinglish': 0.95,
    'marathi': 0.85,
    'mixed-tech': 0.95,
  };
  return rateMap[style || ''] ?? (needsSlowerRate(lang) ? 0.85 : 1.0);
};

const needsSlowerRate = (lang: string): boolean => {
  return ['hi', 'mr', 'ta', 'te', 'bn', 'gu', 'kn'].includes(lang);
};

const selectBestVoice = (languageCode: string = 'en'): SpeechSynthesisVoice | null => {
  if (!('speechSynthesis' in window)) return null;
  
  const getVoices = () => window.speechSynthesis.getVoices();
  let voices = getVoices();
  
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      voices = getVoices();
    };
    return null;
  }
  
  return selectFromList(voices, languageCode);
};

const selectFromList = (voices: SpeechSynthesisVoice[], languageCode: string = 'en'): SpeechSynthesisVoice | null => {
  if (!voices.length) return null;

  const isNonEnglish = languageCode !== 'en';
  
  if (isNonEnglish) {
    const langVoices = voices.filter(v => v.lang.startsWith(languageCode) || v.lang.includes(`-${languageCode.toUpperCase()}`));
    
    if (langVoices.length > 0) {
      const female = langVoices.find(v => 
        v.name.toLowerCase().includes('female') || 
        v.name.toLowerCase().includes('woman') ||
        v.name.toLowerCase().includes('zira') ||
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('ava') ||
        v.name.toLowerCase().includes('female')
      );
      return female || langVoices[0];
    }
  }
  
  const englishKeywords = ['Microsoft Ava', 'Microsoft Zira', 'Samantha', 'Google UK English Female', 'Google US English', 'English United Kingdom Female', 'English US Female'];
  for (const name of englishKeywords) {
    const found = voices.find(v => v.name.includes(name));
    if (found) return found;
  }
  
  const female = voices.find(v => 
    v.name.toLowerCase().includes('female') || 
    v.name.toLowerCase().includes('woman') ||
    v.name.toLowerCase().includes('zira') ||
    v.name.toLowerCase().includes('ava')
  );
  
  return female || voices[0];
};

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const { detectedLang = null, detectedStyle = null } = options;
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  const styleRef = useRef<ConversationStyle | null>(detectedStyle);
  const isActiveRef = useRef(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimRef = useRef('');
  const onResultCallbackRef = useRef<((text: string) => void) | null>(null);
  const internalStatusRef = useRef<string>('idle');
  const speechStartTimeRef = useRef<number>(0);
  const lastInterimTimeRef = useRef<number>(0);
  const languageRef = useRef('en-US');

  useEffect(() => {
    if (detectedLang) {
      languageRef.current = getBcp47(detectedLang);
    } else {
      languageRef.current = 'en-US';
    }
  }, [detectedLang]);

  useEffect(() => {
    styleRef.current = detectedStyle;
  }, [detectedStyle]);

  const isSupported = 
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const setupRecognition = useCallback((recognition: any) => {
    recognition.lang = languageRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListeningRef.current = true;
      speechStartTimeRef.current = Date.now();
      lastInterimTimeRef.current = Date.now();
      setStatus('listening');
    };

    recognition.onspeechstart = () => {
      if (internalStatusRef.current === 'speaking') {
        internalStatusRef.current = 'interrupting';
        
        speechSynthesis.cancel();
        
        if (isActiveRef.current) {
          internalStatusRef.current = 'listening';
          setStatus('listening');
        }
      }
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final.trim()) {
        clearSilenceTimer();
        interimRef.current = '';
        setInterimTranscript('');
        
        if (isListeningRef.current) {
          isListeningRef.current = false;
          recognition.stop();
          setStatus('thinking');
          
          if (onResultCallbackRef.current) {
            onResultCallbackRef.current(final.trim());
          }
        }
      } else if (interim.trim()) {
        clearSilenceTimer();
        interimRef.current = interim;
        setInterimTranscript(interim);
        
        const now = Date.now();
        const speechDuration = now - speechStartTimeRef.current;
        const wordCount = interim.trim().split(/\s+/).length;
        const adaptiveDelay = getAdaptiveSilenceDelay(wordCount, speechDuration);
        
        lastInterimTimeRef.current = now;
        
        silenceTimerRef.current = setTimeout(() => {
          const textToSend = interimRef.current.trim();
          if (textToSend && isListeningRef.current) {
            isListeningRef.current = false;
            interimRef.current = '';
            setInterimTranscript('');
            recognition.stop();
            setStatus('thinking');
            
            if (onResultCallbackRef.current) {
              onResultCallbackRef.current(textToSend);
            }
          }
        }, adaptiveDelay);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') {
        return;
      }
      
      clearSilenceTimer();
      isListeningRef.current = false;
      
      switch (event.error) {
        case 'no-speech':
          break;
        case 'not-allowed':
        case 'audio-capture':
        case 'service-not-allowed':
          setError('Microphone access denied');
          setStatus('error');
          break;
        default:
          setError(`Speech error: ${event.error}`);
          setStatus('error');
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
    };
  }, []);

  const startConversation = useCallback((onResult: (text: string) => void) => {
    if (!isSupported) {
      setError('Speech recognition not supported');
      setStatus('error');
      return;
    }

    if (isListeningRef.current) return;

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      speechSynthesis.cancel();
      clearSilenceTimer();
      speechStartTimeRef.current = 0;
      lastInterimTimeRef.current = 0;

      const SpeechRecognitionConstructor =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;

      if (!SpeechRecognitionConstructor) {
        setError('Speech recognition not available');
        setStatus('error');
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      recognitionRef.current = recognition;
      isActiveRef.current = true;
      isListeningRef.current = true;
      onResultCallbackRef.current = onResult;

      setError(null);
      setInterimTranscript('');
      interimRef.current = '';

      setupRecognition(recognition);
      recognition.start();
    } catch (err: any) {
      isListeningRef.current = false;
      setError(err.message || 'Failed to start');
      setStatus('error');
    }
  }, [isSupported, setupRecognition]);

  const stopConversation = useCallback(() => {
    isActiveRef.current = false;
    clearSilenceTimer();
    interimRef.current = '';

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    isListeningRef.current = false;
    speechSynthesis.cancel();
    setStatus('idle');
    setError(null);
    setInterimTranscript('');
    onResultCallbackRef.current = null;
  }, []);

  const speak = useCallback((text: string, language: string, style?: ConversationStyle): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      speechSynthesis.cancel();
      
      setStatus('speaking');

      const utterance = new SpeechSynthesisUtterance(text);
      
      const langCode = language !== 'en' ? getBcp47(language) : 'en-US';
      utterance.lang = langCode;
      utterance.rate = getTtsRate(style || styleRef.current, language);
      utterance.pitch = 1.0;
      
      const voice = selectBestVoice(language);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        if (isActiveRef.current) {
          const SpeechRecognitionConstructor =
            (window as any).webkitSpeechRecognition ||
            (window as any).SpeechRecognition;

          if (!SpeechRecognitionConstructor) {
            setStatus('idle');
            resolve();
            return;
          }

          try {
            const recognition = new SpeechRecognitionConstructor();
            recognitionRef.current = recognition;
            isListeningRef.current = true;
            
            setupRecognition(recognition);
            recognition.start();
          } catch (e) {
            setStatus('idle');
          }
        } else {
          setStatus('idle');
        }
        resolve();
      };

      utterance.onerror = () => {
        if (isActiveRef.current) {
          const SpeechRecognitionConstructor =
            (window as any).webkitSpeechRecognition ||
            (window as any).SpeechRecognition;

          if (SpeechRecognitionConstructor) {
            try {
              const recognition = new SpeechRecognitionConstructor();
              recognitionRef.current = recognition;
              isListeningRef.current = true;
              
              setupRecognition(recognition);
              recognition.start();
            } catch (e) {
              setStatus('idle');
            }
          } else {
            setStatus('idle');
          }
        } else {
          setStatus('idle');
        }
        resolve();
      };

      speechSynthesis.speak(utterance);
    });
  }, [setupRecognition]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      speechSynthesis.cancel();
    };
  }, []);

  return {
    status,
    interimTranscript,
    error,
    isSupported,
    isListening: isListeningRef.current,
    startConversation,
    stopConversation,
    speak,
  };
}

export type { Status };
