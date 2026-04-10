import { useRef, useState, useCallback, useEffect } from 'react';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface UseVoiceReturn {
  status: Status;
  error: string | null;
  isSupported: boolean;
  startListening: (onResult: (text: string) => void) => void;
  stopAll: () => void;
  speak: (text: string) => Promise<void>;
}

export function useVoice(): UseVoiceReturn {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  const isSupported = 
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const stopAll = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
    window.speechSynthesis.cancel();
    setStatus('idle');
    setError(null);
  }, []);

  const startListening = useCallback((onResult: (text: string) => void) => {
    if (!isSupported) {
      setError('Speech recognition not supported');
      setStatus('error');
      return;
    }

    try {
      const SpeechRecognitionConstructor =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;

      if (!SpeechRecognitionConstructor) {
        throw new Error('Speech recognition not available');
      }

      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();

      const recognition = new SpeechRecognitionConstructor();
      recognitionRef.current = recognition;

      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      setError(null);
      setStatus('listening');
      isListeningRef.current = true;

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setStatus('thinking');
        onResult(text);
      };

      recognition.onerror = (event: any) => {
        isListeningRef.current = false;
        if (event.error === 'no-speech') {
          setStatus('idle');
          return;
        }
        setError(`Speech error: ${event.error}`);
        setStatus('error');
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          isListeningRef.current = false;
          setStatus('idle');
        }
      };

      recognition.start();
    } catch (err: any) {
      isListeningRef.current = false;
      setError(err.message || 'Failed to start speech recognition');
      setStatus('error');
    }
  }, [isSupported]);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;

      setStatus('speaking');

      utterance.onend = () => {
        setStatus('idle');
        resolve();
      };

      utterance.onerror = () => {
        setStatus('idle');
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  return {
    status,
    error,
    isSupported,
    startListening,
    stopAll,
    speak,
  };
}

export type { Status };
