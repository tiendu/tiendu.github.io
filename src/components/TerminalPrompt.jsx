// TerminalPrompt.jsx
import { useState, useEffect, useRef } from 'preact/hooks';

export default function TerminalPrompt({ command = 'me -h', speed = 150, onComplete }) {
  const [displayed, setDisplayed] = useState('');
  const [finished, setFinished] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    let index = 0;
    setDisplayed('');
    const interval = setInterval(() => {
      setDisplayed(prev => prev + command[index]);
      index++;
      if (index >= command.length) {
        clearInterval(interval);
        setFinished(true);
        if (!completedRef.current) {
          completedRef.current = true;
          if (onComplete) onComplete();
        }
      }
    }, speed);
    return () => clearInterval(interval);
  }, [command, speed, onComplete]);

  return (
    <span class="typing">
      {displayed}
      <span class={`cursor ${finished ? 'blinking' : ''}`}>█</span>
    </span>
  );
}

