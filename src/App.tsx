import { useVoice } from './hooks/useVoice';
import { VoiceButton } from './components/VoiceButton';
import { StatusDisplay } from './components/StatusDisplay';

function App() {
  const { state, transcript, response, error, isSupported, startListening, stopListening } = useVoice();

  if (!isSupported) {
    return (
      <div className="app">
        <div className="glass-card">
          <div className="header">
            <h1>Voice Agent</h1>
          </div>
          <div className="error">
            Please use Chrome browser for voice features.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="glass-card">
        <div className="header">
          <h1>Voice Agent</h1>
          <p>Talk to Mistral AI</p>
        </div>

        <div className="led active" />

        <VoiceButton
          state={state}
          onStart={startListening}
          onStop={stopListening}
          disabled={false}
        />

        <StatusDisplay
          state={state}
          transcript={transcript}
          response={response}
          error={error}
        />

        <div className="hint">
          Click the button and speak
        </div>
      </div>
    </div>
  );
}

export default App;
