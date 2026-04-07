import React from 'react';
import { Status } from '../hooks/useVoice';

interface StatusDisplayProps {
  status: Status;
  transcript: string;
  response: string;
  error: string | null;
}

const statusLabels: Record<Status, string> = {
  idle: 'Tap to speak',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
  error: 'Error occurred',
};

export function StatusDisplay({ status, transcript, response, error }: StatusDisplayProps) {
  return (
    <div className="status">
      <div className={`status-text ${status !== 'idle' ? 'active' : ''}`}>
        {statusLabels[status]}
      </div>

      {error && <div className="error">{error}</div>}

      {transcript && status !== 'listening' && (
        <div className="transcript">"{transcript}"</div>
      )}

      {response && status !== 'thinking' && (
        <div className="response">{response}</div>
      )}
    </div>
  );
}
