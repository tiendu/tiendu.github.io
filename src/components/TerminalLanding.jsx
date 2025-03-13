import { useState, useCallback } from 'preact/hooks';
import TerminalPrompt from './TerminalPrompt.jsx';

export default function TerminalLanding({ command = 'me -h', speed = 300, children }) {
  const [typingComplete, setTypingComplete] = useState(false);

  // Memoize onComplete callback
  const handleComplete = useCallback(() => {
    setTypingComplete(true);
  }, []);

  return (
    <div class="terminal">
      <div class="prompt">
        {/* We split coffee@fridge ~ $ into separate spans for custom colors */}
        <span class="username">coffee</span>
        <span class="symbol">@</span>
        <span class="host">fridge</span>
        <span class="separator">~</span>
        <span class="dollar">$</span>
        
        {/* The typewriter effect */}
        <TerminalPrompt command={command} speed={speed} onComplete={handleComplete} />
      </div>
      {typingComplete && (
        <div class="revealed-content">
          {children}
        </div>
      )}
    </div>
  );
}

