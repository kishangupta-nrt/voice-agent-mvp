import React from 'react';
import { Status } from '../hooks/useVoice';

interface VoiceButtonProps {
  status: Status;
  onStart: () => void;
  onStop: () => void;
}

const statusLabels: Record<Status, string> = {
  idle: 'Tap to speak',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
  error: 'Error occurred',
};

export function VoiceButton({ status, onStart, onStop }: VoiceButtonProps) {
  const isActive = status === 'listening' || status === 'speaking';

  const handleClick = () => {
    if (isActive) {
      onStop();
    } else {
      onStart();
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'listening':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        );
      case 'thinking':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        );
      case 'speaking':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        );
      case 'error':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      default:
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        );
    }
  };

  const getClassName = () => {
    let className = 'voice-button';
    if (status === 'listening') className += ' listening';
    if (status === 'speaking') className += ' speaking';
    if (status === 'thinking') className += ' thinking';
    return className;
  };

  return (
    <div className="voice-button-container">
      {status === 'listening' && (
        <>
          <div className="wave active" />
          <div className="wave active" />
        </>
      )}
      <button
        className={getClassName()}
        onClick={handleClick}
        aria-label={isActive ? 'Stop' : 'Start voice input'}
      >
        {getIcon()}
      </button>
    </div>
  );
}
