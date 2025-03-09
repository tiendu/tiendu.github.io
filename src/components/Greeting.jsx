import { useState, useEffect } from 'preact/hooks';

// Define full greetings for each language.
export default function Greeting({ messages, showButton = true, cycleInterval = 2000 }) {
  // Use an index to cycle sequentially through greetings.
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(false);

  // Set up an interval to automatically cycle greetings.
  useEffect(() => {
    const intervalId = setInterval(() => {
      handleNewGreeting();
    }, cycleInterval);
    return () => clearInterval(intervalId);
  }, [cycleInterval]);

  const handleNewGreeting = () => {
    setFade(true);
    setTimeout(() => {
      // Cycle to the next greeting in sequence.
      setIndex(prevIndex => (prevIndex + 1) % messages.length);
      setFade(false);
    }, 500); // Transition duration in ms.
  };

  const currentGreeting = messages[index];

  return (
    <div>
      <h3 className={fade ? 'fade' : ''}>
        {currentGreeting}
      </h3>
      {showButton && (
        <button onClick={handleNewGreeting}>
          New Greeting
        </button>
      )}
      <style>
        {`
          h3 {
            transition: opacity 0.5s ease;
          }
          .fade {
            opacity: 0;
          }
          button {
            margin-top: 1rem;
            padding: 0.5rem 1rem;
            font-size: 1rem;
            cursor: pointer;
          }
        `}
      </style>
    </div>
  );
}

