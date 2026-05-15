import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

// ─── Safe math evaluator (no eval, no backend) ────────────────────────────────
function safeMath(expr) {
  // Replace display symbols back to operators
  const cleaned = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .trim();

  // Validate: only allow digits, operators, parentheses, dot, spaces
  if (!/^[0-9+\-*/.()%\s]+$/.test(cleaned)) {
    throw new Error('Invalid expression');
  }

  // Handle percentage: replace number% with number/100
  const withPct = cleaned.replace(/(\d+\.?\d*)%/g, '($1/100)');

  // Use Function constructor as a safe alternative to eval()
  // eslint-disable-next-line no-new-func
  const result = Function('"use strict"; return (' + withPct + ')')();
  if (!isFinite(result)) throw new Error('Math error');
  return result;
}

// ─── Format large/small numbers nicely ───────────────────────────────────────
function formatResult(num) {
  if (Math.abs(num) >= 1e12 || (Math.abs(num) < 1e-6 && num !== 0)) {
    return num.toExponential(6).replace(/\.?0+e/, 'e');
  }
  // Up to 10 significant digits
  const s = parseFloat(num.toPrecision(10)).toString();
  return s;
}

// ─── Button definitions ───────────────────────────────────────────────────────
const BUTTONS = [
  { label: 'C',   type: 'clear',    span: 1 },
  { label: '⌫',   type: 'delete',   span: 1 },
  { label: '%',   type: 'operator', span: 1 },
  { label: '÷',   type: 'operator', span: 1 },

  { label: '7',   type: 'number',   span: 1 },
  { label: '8',   type: 'number',   span: 1 },
  { label: '9',   type: 'number',   span: 1 },
  { label: '×',   type: 'operator', span: 1 },

  { label: '4',   type: 'number',   span: 1 },
  { label: '5',   type: 'number',   span: 1 },
  { label: '6',   type: 'number',   span: 1 },
  { label: '−',   type: 'operator', span: 1 },

  { label: '1',   type: 'number',   span: 1 },
  { label: '2',   type: 'number',   span: 1 },
  { label: '3',   type: 'number',   span: 1 },
  { label: '+',   type: 'operator', span: 1 },

  { label: '+/-', type: 'negate',   span: 1 },
  { label: '0',   type: 'number',   span: 1 },
  { label: '.',   type: 'decimal',  span: 1 },
  { label: '=',   type: 'equals',   span: 1 },
];

// ─── History item component ───────────────────────────────────────────────────
function HistoryItem({ item, onReuse }) {
  return (
    <button
      className="history-item"
      onClick={() => onReuse(item.result)}
      title="Tap to reuse result"
    >
      <span className="history-expr">{item.expression}</span>
      <span className="history-result">= {item.result}</span>
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [expression, setExpression]   = useState('');
  const [display, setDisplay]         = useState('0');
  const [error, setError]             = useState('');
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [isDark, setIsDark]           = useState(() => {
    const saved = localStorage.getItem('calc-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [history, setHistory]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('calc-history') || '[]'); }
    catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [ripple, setRipple]           = useState(null);     // { key, x, y }
  const [shake, setShake]             = useState(false);

  const displayRef = useRef(null);

  // ── Theme effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    localStorage.setItem('calc-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // ── Persist history ─────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('calc-history', JSON.stringify(history.slice(0, 50)));
  }, [history]);

  // ── Auto-scroll display right ───────────────────────────────────────────────
  useEffect(() => {
    if (displayRef.current) {
      displayRef.current.scrollLeft = displayRef.current.scrollWidth;
    }
  }, [expression]);

  // ── Trigger error shake ─────────────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  // ── Button ripple ───────────────────────────────────────────────────────────
  const fireRipple = useCallback((key, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ key, x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setRipple(null), 600);
  }, []);

  // ── Core handlers ───────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setExpression('');
    setDisplay('0');
    setError('');
    setIsEvaluated(false);
  }, []);

  const handleDelete = useCallback(() => {
    if (isEvaluated) { handleClear(); return; }
    setExpression(prev => {
      const next = prev.slice(0, -1);
      setDisplay(next || '0');
      return next;
    });
    setError('');
  }, [isEvaluated, handleClear]);

  const appendChar = useCallback((char) => {
    if (isEvaluated) {
      // After evaluate: operators continue, numbers start fresh
      const isOp = '÷×−+%'.includes(char);
      if (isOp) {
        setExpression(display + char);
        setDisplay(display + char);
      } else {
        setExpression(char);
        setDisplay(char);
      }
      setIsEvaluated(false);
    } else {
      setExpression(prev => {
        const next = prev + char;
        setDisplay(next);
        return next;
      });
    }
    setError('');
  }, [isEvaluated, display]);

  const handleNegate = useCallback(() => {
    if (isEvaluated) {
      const neg = String(-parseFloat(display));
      setExpression(neg);
      setDisplay(neg);
      setIsEvaluated(false);
      return;
    }
    // Negate the last number in expression
    setExpression(prev => {
      const match = prev.match(/^(.*?)(-?\d+\.?\d*)$/);
      if (!match) return prev;
      const [, prefix, num] = match;
      const toggled = String(-parseFloat(num));
      const next = prefix + toggled;
      setDisplay(next);
      return next;
    });
  }, [isEvaluated, display]);

  const handleEvaluate = useCallback(() => {
    if (!expression || isEvaluated) return;
    try {
      const raw = safeMath(expression);
      const resultStr = formatResult(raw);
      setDisplay(resultStr);
      setError('');
      setIsEvaluated(true);
      setHistory(prev => [
        { expression, result: resultStr, id: Date.now() },
        ...prev,
      ]);
    } catch {
      setError('Error');
      setDisplay('Error');
      triggerShake();
      setTimeout(() => {
        setError('');
        setDisplay(expression || '0');
      }, 1200);
    }
  }, [expression, isEvaluated, triggerShake]);

  // ── Button click handler ─────────────────────────────────────────────────────
  const handleButton = useCallback((btn, e) => {
    fireRipple(btn.label, e);
    switch (btn.type) {
      case 'clear':    handleClear(); break;
      case 'delete':   handleDelete(); break;
      case 'negate':   handleNegate(); break;
      case 'equals':   handleEvaluate(); break;
      case 'number':
      case 'decimal':
      case 'operator': appendChar(btn.label); break;
      default: break;
    }
  }, [fireRipple, handleClear, handleDelete, handleNegate, handleEvaluate, appendChar]);

  // ── Keyboard support ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = {
      '0':'0','1':'1','2':'2','3':'3','4':'4',
      '5':'5','6':'6','7':'7','8':'8','9':'9',
      '.':'.','%':'%','+':'+','-':'−','*':'×','/':'÷',
    };
    const onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (map[e.key])          { e.preventDefault(); appendChar(map[e.key]); }
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); handleEvaluate(); }
      else if (e.key === 'Backspace')              { e.preventDefault(); handleDelete(); }
      else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') { e.preventDefault(); handleClear(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [appendChar, handleEvaluate, handleDelete, handleClear]);

  // ── Reuse from history ───────────────────────────────────────────────────────
  const reuseResult = useCallback((result) => {
    setExpression(result);
    setDisplay(result);
    setIsEvaluated(true);
    setShowHistory(false);
    setError('');
  }, []);

  // ── Display text size class ──────────────────────────────────────────────────
  const displayLen = display.length;
  const displaySizeClass =
    displayLen > 14 ? 'text-2xl sm:text-3xl' :
    displayLen > 10 ? 'text-3xl sm:text-4xl' :
                      'text-4xl sm:text-5xl md:text-6xl';

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-bg">
      {/* Decorative blobs */}
      <div className="blob blob-1" aria-hidden="true" />
      <div className="blob blob-2" aria-hidden="true" />
      <div className="blob blob-3" aria-hidden="true" />

      <div className="calc-wrapper">
        {/* ── Calculator card ────────────────────────────────────────────── */}
        <div className="calc-card">

          {/* Header */}
          <div className="calc-header">
            <span className="calc-title">Calc</span>
            <div className="calc-header-actions">
              {/* History toggle */}
              <button
                id="history-toggle"
                className="icon-btn"
                onClick={() => setShowHistory(s => !s)}
                aria-label="Toggle history"
                title="History"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                  <polyline points="12 7 12 12 16 14"/>
                </svg>
              </button>

              {/* Theme toggle */}
              <button
                id="theme-toggle"
                className="icon-btn"
                onClick={() => setIsDark(d => !d)}
                aria-label="Toggle theme"
                title={isDark ? 'Switch to light' : 'Switch to dark'}
              >
                {isDark ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* History panel */}
          {showHistory && (
            <div className="history-panel">
              <div className="history-header">
                <span>History</span>
                {history.length > 0 && (
                  <button
                    className="clear-history-btn"
                    onClick={() => setHistory([])}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="history-list">
                {history.length === 0 ? (
                  <p className="history-empty">No calculations yet</p>
                ) : (
                  history.map(item => (
                    <HistoryItem key={item.id} item={item} onReuse={reuseResult} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Display */}
          <div className={`calc-display ${shake ? 'shake' : ''}`}>
            {/* Expression */}
            <div ref={displayRef} className="calc-expr">
              {expression || ''}
            </div>
            {/* Main result */}
            <div className={`calc-result ${displaySizeClass} ${error ? 'text-red-400' : ''}`}>
              {display}
            </div>
          </div>

          {/* Keypad */}
          <div className="calc-grid" role="group" aria-label="Calculator buttons">
            {BUTTONS.map((btn) => {
              const isActive = ripple?.key === btn.label;
              return (
                <button
                  key={btn.label}
                  id={`btn-${btn.label.replace(/[^a-z0-9]/gi, '_')}`}
                  className={`calc-btn calc-btn--${btn.type}`}
                  onClick={(e) => handleButton(btn, e)}
                  aria-label={btn.label}
                >
                  <span className="btn-label">{btn.label}</span>
                  {isActive && (
                    <span
                      className="ripple"
                      style={{ left: ripple.x, top: ripple.y }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <p className="calc-hint">Keyboard supported · No server required</p>
        </div>
      </div>
    </div>
  );
}
