import React from 'react';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface UseVoiceReturn {
  state: VoiceState;
  transcript: string;
  response: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
}

export function useVoice(): UseVoiceReturn {
  const [state, setState] = React.useState<VoiceState>('idle');
  const [transcript, setTranscript] = React.useState('');
  const [response, setResponse] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = React.useRef<any>(null);
  const synthesisRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = React.useMemo(() => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }, []);

  const speak = React.useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;

      synthesisRef.current = utterance;

      utterance.onend = () => {
        setState('idle');
        resolve();
      };

      utterance.onerror = () => {
        setState('idle');
        resolve();
      };

      setState('speaking');
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const sendToBackend = React.useCallback(async (message: string): Promise<string> => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      throw new Error('Failed to get response');
    }

    const data = await res.json();
    return data.response;
  }, []);

  const startListening = React.useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    setError(null);
    setTranscript('');
    setResponse('');
    setState('listening');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionConstructor();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);

      setState('thinking');

      try {
        const aiResponse = await sendToBackend(text);
        setResponse(aiResponse);
        await speak(aiResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setState('idle');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        setState('idle');
        return;
      }
      setError(`Speech error: ${event.error}`);
      setState('idle');
    };

    recognition.onend = () => {
      if (state === 'listening') {
        setState('idle');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, sendToBackend, speak, state]);

  const stopListening = React.useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    window.speechSynthesis.cancel();
    setState('idle');
  }, []);

  React.useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  return {
    state,
    transcript,
    response,
    error,
    isSupported,
    startListening,
    stopListening,
  };
}
