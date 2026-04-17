import React from 'react';
import { Status } from '../hooks/useVoice';

interface StatusDisplayProps {
  status: Status;
  transcript: string;
  response: string;
  error: string | null;
  interimTranscript?: string;
  onDismissError?: () => void;
}

const statusLabels: Record<Status, string> = {
  idle: 'Tap to speak',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
  error: 'Error occurred',
};

export function StatusDisplay({ status, transcript, response, error, interimTranscript, onDismissError }: StatusDisplayProps) {
  return (
    <div className="status">
      <div className={`status-text ${status !== 'idle' ? 'active' : ''}`}>
        {statusLabels[status]}
      </div>

      {error && (
        <div className="error" onClick={onDismissError} style={{ cursor: onDismissError ? 'pointer' : 'default' }}>
          {error}
          {onDismissError && <span style={{ marginLeft: '8px', opacity: 0.7 }}>(tap to dismiss)</span>}
        </div>
      )}

      {interimTranscript && (
        <div className="transcript interim">"{interimTranscript}"</div>
      )}

      {transcript && !interimTranscript && (
        <div className="transcript">"{transcript}"</div>
      )}

      {response && (
        <div className="response">{response}</div>
      )}
    </div>
  );
}
