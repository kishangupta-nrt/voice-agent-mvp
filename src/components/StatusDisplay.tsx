type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface StatusDisplayProps {
  state: VoiceState;
  transcript: string;
  response: string;
  error: string | null;
}

const stateLabels: Record<VoiceState, string> = {
  idle: 'Tap to speak',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
};

export function StatusDisplay({ state, transcript, response, error }: StatusDisplayProps) {
  return (
    <div className="status">
      <div className={`status-text ${state !== 'idle' ? 'active' : ''}`}>
        {stateLabels[state]}
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {transcript && state !== 'listening' && (
        <div className="transcript">"{transcript}"</div>
      )}
      
      {response && state !== 'thinking' && (
        <div className="response">{response}</div>
      )}
    </div>
  );
}
