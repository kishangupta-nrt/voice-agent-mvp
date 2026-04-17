import { useRef, useState, useCallback, useEffect } from 'react';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface UseVoiceReturn {
  status: Status;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  isListening: boolean;
  startConversation: (onResult: (text: string) => void) => void;
  stopConversation: () => void;
  speak: (text: string) => Promise<void>;
}

const SILENCE_DELAY = 700;

export function useVoice(): UseVoiceReturn {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  const isActiveRef = useRef(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimRef = useRef('');
  const onResultCallbackRef = useRef<((text: string) => void) | null>(null);
  const statusRef = useRef<Status>('idle');
  const internalStatusRef = useRef<string>('idle');

  useEffect(() => {
    statusRef.current = status;
    internalStatusRef.current = status;
  }, [status]);

  const isSupported = 
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const setupRecognition = useCallback((recognition: any) => {
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListeningRef.current = true;
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
        }, SILENCE_DELAY);
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

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      speechSynthesis.cancel();
      
      statusRef.current = 'speaking';
      setStatus('speaking');

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;

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
