import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('0');
  const [error, setError] = useState('');
  const [isEvaluated, setIsEvaluated] = useState(false);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage or system preference on initial load
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply theme class to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleNumber = (num) => {
    if (isEvaluated) {
      setExpression(num);
      setResult('0');
      setIsEvaluated(false);
      setError('');
    } else {
      setExpression((prev) => prev + num);
      setError('');
    }
  };

  const handleOperator = (op) => {
    if (isEvaluated) {
      setExpression(result + op);
      setIsEvaluated(false);
      setError('');
    } else {
      setExpression((prev) => prev + op);
      setError('');
    }
  };

  const handleClear = () => {
    setExpression('');
    setResult('0');
    setError('');
    setIsEvaluated(false);
  };

  const handleDelete = () => {
    if (isEvaluated) return;
    setExpression((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleEvaluate = async () => {
    if (!expression) return;
    
    try {
      const response = await fetch('http://localhost:8080/api/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expression }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Calculation failed');
      } else {
        setResult(String(data.result));
        setIsEvaluated(true);
      }
    } catch (err) {
      setError('Cannot connect to server');
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key;
      
      if (/[0-9.]/.test(key)) {
        e.preventDefault();
        handleNumber(key);
      } else if (['+', '-', '*', '/', '(', ')'].includes(key)) {
        e.preventDefault();
        handleOperator(key);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleEvaluate();
      } else if (key === 'Escape' || key === 'c' || key === 'C') {
        e.preventDefault();
        handleClear();
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expression, result, isEvaluated, error]);

  return (
  <div className="w-full min-h-screen flex items-center justify-center px-3 sm:px-6 lg:px-10 py-4">
    
    <div className="w-full max-w-xs sm:max-w-sm md:max-w-md 
    glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-8 
    flex flex-col gap-4 sm:gap-6">

      {/* Header */}
      <div className="flex justify-end">
        <button 
          onClick={toggleTheme}
          className="p-2 sm:p-3 rounded-full bg-slate-200 dark:bg-slate-700 
          hover:bg-slate-300 dark:hover:bg-slate-600 transition text-xl w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center"
          aria-label="Toggle theme"
        >
          {isDarkMode ? '🌙' : '☀️'}
        </button>
      </div>

      {/* Display */}
      <div className="glass-display rounded-xl sm:rounded-2xl p-4 sm:p-6 
      flex flex-col items-end justify-center 
      min-h-[100px] sm:min-h-[130px] 
      break-all overflow-hidden">

        <div className="text-slate-500 dark:text-slate-400 
        text-sm sm:text-base min-h-[1.5rem]">
          {expression}
        </div>

        {error ? (
          <div className="text-red-500 text-lg sm:text-xl">
            {error}
          </div>
        ) : (
          <div className="text-slate-800 dark:text-white 
          text-4xl sm:text-5xl font-bold">
            {result}
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-3 sm:gap-4">

        {/* Buttons */}
        {[
          "C","(",")","/",
          "7","8","9","*",
          "4","5","6","-",
          "1","2","3","+",
          "0",".","="
        ].map((btn, i) => (
          <button
            key={i}
            onClick={() => {
              if (btn === "C") return handleClear();
              if (btn === "=") return handleEvaluate();
              if ("+-*/()".includes(btn)) return handleOperator(btn);
              return handleNumber(btn);
            }}
            className={`calc-btn ${
              btn === "C" ? "calc-btn-clear" :
              btn === "=" ? "calc-btn-equals" :
              "+-*/()".includes(btn) ? "calc-btn-operator" : ""
            }`}
          >
            {btn}
          </button>
        ))}
      </div>

    </div>
  </div>
);
}

export default App;
